const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../config/database");
const { createBooking } = require("../controllers/bookingController");
const { createContact } = require("../controllers/contactController");

const runController = async (handler, body, failOnOutbox = false) => {
    const events = [];
    let insertedValues;
    const originalGetConnection = db.getConnection;
    const originalConsoleError = console.error;
    let responseStatus;
    let responseBody;

    db.getConnection = async () => ({
        async beginTransaction() {
            events.push("begin");
        },
        async execute(query, values) {
            events.push(query.includes("notification_outbox") ? "enqueue" : "insert");
            assert.ok(Array.isArray(values));
            if (query.includes("INSERT INTO contacts") || query.includes("INSERT INTO bookings")) {
                insertedValues = values;
            }
            if (failOnOutbox && query.includes("notification_outbox")) {
                throw new Error("outbox unavailable");
            }
            return [{ insertId: 42, affectedRows: 1 }];
        },
        async commit() {
            events.push("commit");
        },
        async rollback() {
            events.push("rollback");
        },
        release() {
            events.push("release");
        }
    });
    console.error = () => {};

    try {
        const response = {
            status(status) {
                responseStatus = status;
                return this;
            },
            json(bodyValue) {
                responseBody = bodyValue;
                return this;
            }
        };
        await handler({ body }, response);
    } finally {
        db.getConnection = originalGetConnection;
        console.error = originalConsoleError;
    }

    return { events, insertedValues, responseStatus, responseBody };
};

test("contact and notification enqueue commit atomically", async () => {
    const result = await runController(createContact, {
        name: "Test User",
        email: " user@example.test ",
        phone: "123456",
        subject: "Tour",
        message: "Please contact me"
    });

    assert.deepEqual(result.events, ["begin", "insert", "enqueue", "commit", "release"]);
    assert.equal(result.insertedValues[1], "user@example.test");
    assert.equal(result.responseStatus, 201);
    assert.equal(result.responseBody.success, true);
});

test("booking and notification enqueue commit atomically", async () => {
    const result = await runController(createBooking, {
        full_name: "Test User",
        email: " user@example.test ",
        phone: "123456",
        pickup_location: "Airport",
        destination: "Marrakech",
        travel_date: "2026-10-17",
        pickup_time: "12:30",
        passengers: 2,
        vehicle_type: "Premium Sedan"
    });

    assert.deepEqual(result.events, ["begin", "insert", "enqueue", "commit", "release"]);
    assert.equal(result.insertedValues[1], "user@example.test");
    assert.equal(result.responseStatus, 201);
    assert.equal(result.responseBody.success, true);
});

test("failed notification enqueue rolls back the form submission", async () => {
    const result = await runController(createContact, {
        name: "Test User",
        email: "user@example.test",
        message: "Please contact me"
    }, true);

    assert.deepEqual(result.events, ["begin", "insert", "enqueue", "rollback", "release"]);
    assert.equal(result.responseStatus, 500);
    assert.equal(result.responseBody.success, false);
});
