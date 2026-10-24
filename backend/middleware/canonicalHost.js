const CANONICAL_HOST = "oumamatours.site";

const redirectCanonicalHost = (req, res, next) => {
    if (req.hostname.toLowerCase() === `www.${CANONICAL_HOST}`) {
        return res.redirect(308, `https://${CANONICAL_HOST}${req.originalUrl}`);
    }

    return next();
};

module.exports = redirectCanonicalHost;
