// Session-based auth middleware (database-backed via express-session)

const requireAuth = (req, res, next) => {
    if (req.session && req.session.username) {
        // Session valid, set req.username for backward compatibility
        req.username = req.session.username;
        return next();
    }
    res.redirect('/login');
};

module.exports = { requireAuth };