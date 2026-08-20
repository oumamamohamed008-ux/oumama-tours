const express = require("express");
const requireAdminKey = require("../middleware/adminAuth");

const {
    createBooking,
    getBookings
} = require("../controllers/bookingController");

const router = express.Router();

// POST : créer une réservation
router.post("/", createBooking);

// GET : récupérer les réservations
router.get("/", requireAdminKey, getBookings);

module.exports = router;