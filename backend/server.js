
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./config/database");
const bookingRoutes = require("./routes/bookingRoutes");
const contactRoutes = require("./routes/contactRoutes");
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : false
}));
app.use(express.json());

app.get("/api/health", async (req, res) => {

    try {

        const [rows] = await db.query("SELECT 1 AS test");

        res.json({
            success: true,
            message: "Oumama Tours API + MySQL connected",
            database: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });

    }

});

app.use("/api/bookings", bookingRoutes);
app.use("/api/contacts", contactRoutes);
app.use(express.static(path.join(__dirname, "..")));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Oumama Tours API running on http://localhost:${PORT}`
    );
});