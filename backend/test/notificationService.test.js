const assert = require("node:assert/strict");
const test = require("node:test");
const {
    createNotificationService,
    formatNotification,
    retryDelayMs
} = require("../services/notificationService");

const smtpEnv = {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_USER: "sender@example.test",
    SMTP_PASSWORD: "test-only-secret",
    NOTIFICATION_EMAIL: "admin@example.test"
};

test("contact notification contains useful fields and no SMTP credentials", () => {
    const notification = formatNotification("contact", {
        name: "Test User",
        email: "user@example.test",
        phone: "123456",
        subject: "Tour",
        message: "Please contact me"
    });

    assert.equal(notification.replyTo, "user@example.test");
    assert.match(notification.text, /Please contact me/);
    assert.doesNotMatch(notification.text, /test-only-secret/);
});

test("booking notification includes trip details but no SMTP credentials", () => {
    const notification = formatNotification("booking", {
        full_name: "Test User",
        email: "user@example.test",
        phone: "123456",
        pickup_location: "Airport",
        destination: "Marrakech",
        travel_date: "2026-10-17",
        pickup_time: "12:30",
        passengers: "2",
        vehicle_type: "Premium Sedan",
        return_trip: 1,
        flight_number: null,
        hotel: "Test Hotel",
        additional_requests: "Child seat"
    });

    assert.match(notification.text, /Destination: Marrakech/);
    assert.match(notification.text, /Additional requests:\nChild seat/);
    assert.doesNotMatch(notification.text, /test-only-secret/);
});

test("retry delay increases and is capped", () => {
    assert.equal(retryDelayMs(1), 60_000);
    assert.equal(retryDelayMs(2), 120_000);
    assert.equal(retryDelayMs(100), 6 * 60 * 60 * 1000);
});

test("failed SMTP delivery stays queued and logs no secret or SMTP error text", async () => {
    const logEntries = [];
    const updates = [];
    const failureCodes = ["EAUTH", smtpEnv.SMTP_PASSWORD];
    let claimedCount = 0;
    const db = {
        async getConnection() {
            return {
                async beginTransaction() {},
                async execute(query, params) {
                    if (query.includes("SELECT id, event_type")) {
                        const id = 7 + claimedCount;
                        claimedCount += 1;
                        return [[{ id, event_type: "contact", record_id: 12, attempts: 0 }]];
                    }
                    updates.push({ query, params });
                    return [{ affectedRows: 1 }];
                },
                async commit() {},
                async rollback() {},
                release() {}
            };
        },
        async execute(query, params) {
            if (query.includes("FROM contacts")) {
                return [[{
                    name: "Test User",
                    email: "user@example.test",
                    phone: null,
                    subject: null,
                    message: "Test body"
                }]];
            }
            updates.push({ query, params });
            return [{ affectedRows: 1 }];
        }
    };
    const service = createNotificationService({
        db,
        env: smtpEnv,
        logger: {
            info: (...args) => logEntries.push(args),
            error: (...args) => logEntries.push(args)
        },
        createTransport: () => ({
            async sendMail() {
                const error = new Error("SMTP failed with test-only-secret");
                error.code = failureCodes.shift();
                throw error;
            }
        })
    });

    assert.equal(await service.processNext(), true);
    assert.equal(await service.processNext(), true);
    assert.equal(updates.length, 4);
    assert.match(updates[1].query, /available_at = DATE_ADD/);
    assert.equal(updates[1].params[0], 60);
    assert.equal(updates[1].params[1], 7);
    const serializedLogs = JSON.stringify(logEntries);
    assert.doesNotMatch(serializedLogs, /test-only-secret|SMTP failed/);
    assert.match(serializedLogs, /EAUTH/);
    assert.match(serializedLogs, /DELIVERY_FAILED/);
});

test("successful SMTP delivery marks the queued notification sent", async () => {
    const updates = [];
    const messages = [];
    let transportOptions;
    const db = {
        async getConnection() {
            return {
                async beginTransaction() {},
                async execute(query) {
                    if (query.includes("SELECT id, event_type")) {
                        return [[{ id: 8, event_type: "booking", record_id: 14, attempts: 0 }]];
                    }
                    return [{ affectedRows: 1 }];
                },
                async commit() {},
                async rollback() {},
                release() {}
            };
        },
        async execute(query) {
            if (query.includes("FROM bookings")) {
                return [[{
                    full_name: "Test User",
                    email: "user@example.test",
                    phone: "123456",
                    pickup_location: "Airport",
                    destination: "Marrakech",
                    travel_date: "2026-10-17",
                    pickup_time: "12:30",
                    passengers: "2",
                    vehicle_type: "Premium Sedan",
                    return_trip: 0,
                    flight_number: null,
                    hotel: null,
                    additional_requests: null
                }]];
            }
            updates.push(query);
            return [{ affectedRows: 1 }];
        }
    };
    const service = createNotificationService({
        db,
        env: smtpEnv,
        logger: { info() {}, error() {} },
        createTransport: (options) => {
            transportOptions = options;
            return {
                async sendMail(message) {
                    messages.push(message);
                    return { accepted: [smtpEnv.NOTIFICATION_EMAIL], rejected: [] };
                }
            };
        }
    });

    assert.equal(await service.processNext(), true);
    assert.equal(messages[0].to, smtpEnv.NOTIFICATION_EMAIL);
    assert.equal(messages[0].replyTo, "user@example.test");
    assert.equal(transportOptions.host, smtpEnv.SMTP_HOST);
    assert.equal(transportOptions.port, 465);
    assert.equal(transportOptions.secure, true);
    assert.match(messages[0].text, /Destination: Marrakech/);
    assert.doesNotMatch(messages[0].text, /test-only-secret/);
    assert.equal(updates.length, 1);
    assert.match(updates[0], /sent_at = CURRENT_TIMESTAMP/);
});
