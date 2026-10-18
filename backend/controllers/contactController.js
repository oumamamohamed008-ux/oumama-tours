const db = require("../config/database");

// Créer un message
const createContact = async (req, res) => {
    let connection;
    try {
        const {
            name,
            email,
            phone,
            subject,
            message
        } = req.body;

        // Vérification
        if (
            !name ||
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            !message
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        const sql = `
            INSERT INTO contacts (
                name,
                email,
                phone,
                subject,
                message
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            name,
            email.trim(),
            phone || null,
            subject || null,
            message
        ];

        connection = await db.getConnection();
        await connection.beginTransaction();
        const [result] = await connection.execute(sql, values);
        await connection.execute(
            `INSERT INTO notification_outbox (event_type, record_id)
             VALUES ('contact', ?)`,
            [result.insertId]
        );
        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Your message has been received successfully.",
            contact_id: result.insertId
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Contact error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while sending your message."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// Récupérer tous les messages
const getContacts = async (req, res) => {
    try {

        const [contacts] = await db.execute(
            "SELECT * FROM contacts ORDER BY created_at DESC"
        );

        res.json({
            success: true,
            contacts: contacts
        });

    } catch (error) {

        console.error("Get contacts error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


module.exports = {
    createContact,
    getContacts
};