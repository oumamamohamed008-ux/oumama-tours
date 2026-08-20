const db = require("../config/database");

// Créer un message
const createContact = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            subject,
            message
        } = req.body;

        // Vérification
        if (!name || !email || !message) {
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
            email,
            phone || null,
            subject || null,
            message
        ];

        const [result] = await db.execute(sql, values);

        res.status(201).json({
            success: true,
            message: "Your message has been sent successfully.",
            contact_id: result.insertId
        });

    } catch (error) {

        console.error("Contact error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while sending your message."
        });
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