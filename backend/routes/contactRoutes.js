const express = require("express");
const requireAdminKey = require("../middleware/adminAuth");

const {
    createContact,
    getContacts
} = require("../controllers/contactController");

const router = express.Router();

// Envoyer un message
router.post("/", createContact);

// Récupérer les messages
router.get("/", requireAdminKey, getContacts);

module.exports = router;