const prisma = require('../config/prisma');
const { parseCookies, sessions } = require('./authMiddleware');

// Extensions file statis yang TIDAK perlu dicek maintenance
const STATIC_EXTENSIONS = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|avif|mp4|webm)$/i;

// Rute yang harus selalu bisa diakses (tidak di-redirect)
const EXCLUDED_PATHS = ['/login', '/auth', '/maintenance', '/api/auth'];

const maintenanceCheck = async (req, res, next) => {
    // 1. IZINKAN: file statis (punya ekstensi .css, .js, .png, dll)
    if (STATIC_EXTENSIONS.test(req.path)) {
        return next();
    }

    // 2. IZINKAN: rute essential (login, auth, maintenance)
    const isExcluded = EXCLUDED_PATHS.some(p => req.path.toLowerCase().startsWith(p));
    if (isExcluded) {
        return next();
    }

    try {
        const config = await prisma.$queryRaw`SELECT is_maintenance FROM admin_config LIMIT 1`;
        const isMaintenance = config.length > 0 && config[0].is_maintenance === true;

        console.log(`[Maintenance] Path: ${req.path} | is_maintenance: ${isMaintenance}`);

        if (isMaintenance) {
            // 3. CEK LOGIN: admin yang sudah login → bypass, bisa akses semua halaman
            const cookies = parseCookies(req);
            const sessionId = cookies.session_id;

            if (sessionId && sessions.has(sessionId)) {
                console.log(`[Maintenance] Admin session detected → bypass`);
                return next();
            }

            // 4. BLOCK: user publik tanpa session → redirect ke maintenance
            console.log(`[Maintenance] Redirecting ${req.path} → /maintenance`);
            return res.redirect('/maintenance');
        }
    } catch (error) {
        console.error('[Maintenance] Check Error:', error.message);
    }
    next();
};

module.exports = maintenanceCheck;
