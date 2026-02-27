const sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 menit

const parseCookies = (request) => {
    const list = {}, rc = request.headers.cookie;
    rc && rc.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
};

const requireAuth = (req, res, next) => {
    const cookies = parseCookies(req);
    const sessionId = cookies.session_id;

    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        const now = Date.now();

        if (now - session.lastActivity > SESSION_TIMEOUT) {
            sessions.delete(sessionId);
            res.setHeader('Set-Cookie', 'session_id=; HttpOnly; Path=/; Max-Age=0');
            return res.redirect('/login?error=timeout');
        }

        session.lastActivity = now;
        req.username = session.username;
        return next();
    }
    res.redirect('/login');
};

module.exports = { requireAuth, sessions, parseCookies };