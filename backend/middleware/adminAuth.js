const crypto = require("crypto");

const requireAdminKey = (req, res, next) => {
    const configuredKey = process.env.ADMIN_API_KEY;
    const providedKey = req.get("x-admin-key");

    if (!configuredKey || !providedKey) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    const expected = Buffer.from(configuredKey);
    const received = Buffer.from(providedKey);

    if (
        expected.length !== received.length ||
        !crypto.timingSafeEqual(expected, received)
    ) {
        return res.status(403).json({
            success: false,
            message: "Invalid admin credentials."
        });
    }

    next();
};

module.exports = requireAdminKey;