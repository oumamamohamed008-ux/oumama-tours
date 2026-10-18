const nodemailer = require("nodemailer");

const POLL_INTERVAL_MS = 10_000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
const SAFE_ERROR_CODES = new Set([
    "EAUTH",
    "ECONNECTION",
    "ECONNREFUSED",
    "ECONNRESET",
    "EDNS",
    "EENVELOPE",
    "EMESSAGE",
    "ESOCKET",
    "ETIMEDOUT",
    "SMTP_CONFIG",
    "RECIPIENT_NOT_ACCEPTED"
]);
const sourceQueries = {
    contact: "SELECT name, email, phone, subject, message FROM contacts WHERE id = ? LIMIT 1",
    booking: `SELECT full_name, email, phone, pickup_location, destination, travel_date,
                     pickup_time, passengers, vehicle_type, return_trip, flight_number,
                     hotel, additional_requests
              FROM bookings WHERE id = ? LIMIT 1`
};

const retryDelayMs = (attempt) =>
    Math.min(60_000 * (2 ** Math.min(Math.max(attempt - 1, 0), 10)), MAX_RETRY_DELAY_MS);

const safeErrorCode = (error, fallback) =>
    typeof error.code === "string" && SAFE_ERROR_CODES.has(error.code)
        ? error.code
        : fallback;

const formatNotification = (eventType, record) => {
    if (eventType === "contact") {
        return {
            subject: "New contact message - Oumama Tours",
            replyTo: record.email,
            text: [
                "A new contact message was received.",
                "",
                `Name: ${record.name}`,
                `Email: ${record.email}`,
                `Phone: ${record.phone || "Not provided"}`,
                `Subject: ${record.subject || "Not provided"}`,
                "",
                "Message:",
                record.message
            ].join("\n")
        };
    }

    if (eventType === "booking") {
        return {
            subject: "New booking request - Oumama Tours",
            replyTo: record.email,
            text: [
                "A new booking request was received.",
                "",
                `Name: ${record.full_name}`,
                `Email: ${record.email}`,
                `Phone: ${record.phone}`,
                `Pick-up: ${record.pickup_location}`,
                `Destination: ${record.destination}`,
                `Date: ${record.travel_date}`,
                `Time: ${record.pickup_time}`,
                `Passengers: ${record.passengers}`,
                `Vehicle: ${record.vehicle_type}`,
                `Return trip: ${record.return_trip ? "Yes" : "No"}`,
                `Flight number: ${record.flight_number || "Not provided"}`,
                `Hotel: ${record.hotel || "Not provided"}`,
                "",
                "Additional requests:",
                record.additional_requests || "None"
            ].join("\n")
        };
    }

    throw new Error("Unsupported notification type");
};

const createNotificationService = ({
    db,
    env = process.env,
    logger = console,
    createTransport = nodemailer.createTransport
}) => {
    let transporter;
    let interval;
    let processing = false;

    const getTransporter = () => {
        if (transporter) {
            return transporter;
        }

        const requiredSettings = [
            "SMTP_HOST",
            "SMTP_PORT",
            "SMTP_USER",
            "SMTP_PASSWORD",
            "NOTIFICATION_EMAIL"
        ];
        const missingSettings = requiredSettings.filter((key) => !env[key]);
        const port = Number(env.SMTP_PORT);

        if (missingSettings.length || !Number.isInteger(port) || port < 1 || port > 65535) {
            const error = new Error("SMTP configuration is incomplete");
            error.code = "SMTP_CONFIG";
            throw error;
        }

        transporter = createTransport({
            host: env.SMTP_HOST,
            port,
            secure: port === 465,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASSWORD
            },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 30_000
        });

        return transporter;
    };

    const claimNext = async () => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                `SELECT id, event_type, record_id, attempts
                 FROM notification_outbox
                 WHERE sent_at IS NULL
                   AND available_at <= CURRENT_TIMESTAMP
                   AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
                 ORDER BY id
                 LIMIT 1
                 FOR UPDATE`
            );

            if (!rows.length) {
                await connection.commit();
                return null;
            }

            const item = rows[0];
            item.attempts += 1;
            await connection.execute(
                `UPDATE notification_outbox
                 SET attempts = ?, locked_until = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 120 SECOND)
                 WHERE id = ?`,
                [item.attempts, item.id]
            );
            await connection.commit();
            return item;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    };

    const loadRecord = async (item) => {
        const query = sourceQueries[item.event_type];
        if (!query) {
            throw new Error("Unsupported notification type");
        }
        const [rows] = await db.execute(
            query,
            [item.record_id]
        );
        if (!rows.length) {
            throw new Error("Notification source record is missing");
        }
        return rows[0];
    };

    const markSent = (id) =>
        db.execute(
            `UPDATE notification_outbox
             SET sent_at = CURRENT_TIMESTAMP, locked_until = NULL
             WHERE id = ? AND sent_at IS NULL`,
            [id]
        );

    const scheduleRetry = (item, error) => {
        const delaySeconds = Math.ceil(retryDelayMs(item.attempts) / 1000);
        return db.execute(
            `UPDATE notification_outbox
             SET available_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND),
                 locked_until = NULL
             WHERE id = ? AND sent_at IS NULL`,
            [delaySeconds, item.id]
        ).then(() => {
            const code = safeErrorCode(error, "DELIVERY_FAILED");
            logger.error("Email notification delivery failed; retry scheduled.", {
                notificationId: item.id,
                attempt: item.attempts,
                code
            });
        });
    };

    const processNext = async () => {
        const item = await claimNext();
        if (!item) {
            return false;
        }

        try {
            const record = await loadRecord(item);
            const notification = formatNotification(item.event_type, record);
            const mailer = getTransporter();
            const result = await mailer.sendMail({
                from: { name: "Oumama Tours", address: env.SMTP_USER },
                to: env.NOTIFICATION_EMAIL,
                replyTo: notification.replyTo,
                subject: notification.subject,
                text: notification.text,
                disableFileAccess: true,
                disableUrlAccess: true
            });

            const accepted = Array.isArray(result.accepted)
                && result.accepted.some((address) =>
                    String(address).toLowerCase() === env.NOTIFICATION_EMAIL.toLowerCase()
                );
            if (!accepted) {
                const error = new Error("SMTP server did not accept the notification recipient");
                error.code = "RECIPIENT_NOT_ACCEPTED";
                throw error;
            }

            await markSent(item.id);
            logger.info("Email notification delivered.", { notificationId: item.id });
        } catch (error) {
            await scheduleRetry(item, error);
        }

        return true;
    };

    const run = async () => {
        if (processing) {
            return;
        }
        processing = true;
        try {
            await processNext();
        } catch (error) {
            const code = safeErrorCode(error, "QUEUE_FAILED");
            logger.error("Email notification queue processing failed.", { code });
        } finally {
            processing = false;
        }
    };

    return {
        processNext,
        start() {
            if (interval) {
                return;
            }
            void run();
            interval = setInterval(() => void run(), POLL_INTERVAL_MS);
            interval.unref();
        },
        stop() {
            if (interval) {
                clearInterval(interval);
                interval = undefined;
            }
            if (transporter && typeof transporter.close === "function") {
                transporter.close();
                transporter = undefined;
            }
        }
    };
};

module.exports = {
    createNotificationService,
    formatNotification,
    retryDelayMs
};
