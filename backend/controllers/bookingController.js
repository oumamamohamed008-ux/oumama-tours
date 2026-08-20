const db = require("../config/database");

// Créer une réservation
const createBooking = async (req, res) => {
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
            email,
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

        const [result] = await db.execute(sql, values);

        res.status(201).json({
            success: true,
            message: "Booking submitted successfully.",
            booking_id: result.insertId
        });

    } catch (error) {

        console.error("Booking error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while creating booking."
        });
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