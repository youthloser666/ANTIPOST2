const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/prisma');
const { sessions, parseCookies } = require('../middleware/authMiddleware');

exports.loginPage = (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
};

exports.login = async (req, res) => {
    const { username, password, pin } = req.body;
    try {
        const user = await prisma.admin_users.findUnique({
            where: { username }
        });
        if (user) {
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            const isPinValid = await bcrypt.compare(pin, user.pin_hash);

            if (isPasswordValid && isPinValid) {
                const sessionId = crypto.randomBytes(16).toString('hex');
                sessions.set(sessionId, { lastActivity: Date.now(), username: user.username });
                res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=86400`);
                return res.redirect('/admin');
            }
        }
    } catch (error) {
        console.error("Login Error:", error);
    }
    res.redirect('/login?error=1');
};

exports.logout = (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.session_id) sessions.delete(cookies.session_id);
    res.setHeader('Set-Cookie', 'session_id=; HttpOnly; Path=/; Max-Age=0');
    res.redirect('/login');
};

exports.validatePassword = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.admin_users.findUnique({
            where: { username }
        });
        if (user) {
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (isPasswordValid) return res.json({ success: true });
        }
    } catch (error) {
        console.error("Validate Password Error:", error);
    }
    res.json({ success: false });
};

exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const username = req.username;
    try {
        const user = await prisma.admin_users.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const match = await bcrypt.compare(oldPassword, user.password_hash);
        if (!match) return res.json({ success: false, message: 'Password lama salah' });

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.admin_users.update({
            where: { username },
            data: { password_hash: newHash }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.changePin = async (req, res) => {
    const { oldPin, newPin } = req.body;
    const username = req.username;
    try {
        const user = await prisma.admin_users.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const match = await bcrypt.compare(oldPin, user.pin_hash);
        if (!match) return res.json({ success: false, message: 'PIN lama salah' });

        const newHash = await bcrypt.hash(newPin, 10);
        await prisma.admin_users.update({
            where: { username },
            data: { pin_hash: newHash }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Change PIN Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};