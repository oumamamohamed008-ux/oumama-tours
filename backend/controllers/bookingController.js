const db = require("../config/database");

// Créer une réservation
const createBooking = async (req, res) => {
    let connection;
    try {
        const {
            full_name,
            email,
            phone,
            pickup_location,
            destination,
            travel_date,
            pickup_time,
            passengers,
            vehicle_type,
            return_trip,
            flight_number,
            hotel,
            additional_requests
        } = req.body;

        // Vérification des champs obligatoires
        if (
            !full_name ||
            !email ||
            !phone ||
            !pickup_location ||
            !destination ||
            !travel_date ||
            !pickup_time ||
            !passengers ||
            !vehicle_type
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        if (
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const sql = `
            INSERT INTO bookings (
                full_name,
                email,
                phone,
                pickup_location,
                destination,
                travel_date,
                pickup_time,
                passengers,
                vehicle_type,
                return_trip,
                flight_number,
                hotel,
                additional_requests
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            full_name,
            email.trim(),
            phone,
            pickup_location,
            destination,
            travel_date,
            pickup_time,
            passengers,
            vehicle_type,
            return_trip ? 1 : 0,
            flight_number || null,
            hotel || null,
            additional_requests || null
        ];

        connection = await db.getConnection();
        await connection.beginTransaction();
        const [result] = await connection.execute(sql, values);
        await connection.execute(
            `INSERT INTO notification_outbox (event_type, record_id)
             VALUES ('booking', ?)`,
            [result.insertId]
        );
        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Booking request received successfully.",
            booking_id: result.insertId
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Booking error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while creating booking."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// Récupérer toutes les réservations
const getBookings = async (req, res) => {
    try {

        const [bookings] = await db.execute(
            "SELECT * FROM bookings ORDER BY created_at DESC"
        );

        res.json({
            success: true,
            bookings: bookings
        });

    } catch (error) {

        console.error("Get bookings error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


module.exports = {
    createBooking,
    getBookings
};