const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/prisma');
const { sessions, parseCookies } = require('../middleware/authMiddleware');

exports.loginPage = (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
};

exports.login = async (req, res) => {
    const { password, pin } = req.body;
    try {
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        if (admins.length > 0) {
            const admin = admins[0];
            const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
            const isPinValid = await bcrypt.compare(pin, admin.pin_hash);

            if (isPasswordValid && isPinValid) {
                const sessionId = crypto.randomBytes(16).toString('hex');
                sessions.set(sessionId, Date.now());
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
    const { password } = req.body;
    try {
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        if (admins.length > 0) {
            const isPasswordValid = await bcrypt.compare(password, admins[0].password_hash);
            if (isPasswordValid) return res.json({ success: true });
        }
    } catch (error) {
        console.error("Validate Password Error:", error);
    }
    res.json({ success: false });
};

exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        if (admins.length === 0) return res.status(404).json({ success: false, message: 'Admin config not found' });
        
        const admin = admins[0];
        const match = await bcrypt.compare(oldPassword, admin.password_hash);
        if (!match) return res.json({ success: false, message: 'Password lama salah' });

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.$executeRaw`UPDATE admin_config SET password_hash = ${newHash} WHERE id = ${admin.id}`;
        
        res.json({ success: true });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.changePin = async (req, res) => {
    const { oldPin, newPin } = req.body;
    try {
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        if (admins.length === 0) return res.status(404).json({ success: false, message: 'Admin config not found' });
        
        const admin = admins[0];
        const match = await bcrypt.compare(oldPin, admin.pin_hash);
        if (!match) return res.json({ success: false, message: 'PIN lama salah' });

        const newHash = await bcrypt.hash(newPin, 10);
        await prisma.$executeRaw`UPDATE admin_config SET pin_hash = ${newHash} WHERE id = ${admin.id}`;
        
        res.json({ success: true });
    } catch (error) {
        console.error("Change PIN Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};