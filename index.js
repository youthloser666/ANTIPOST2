require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { requireAuth } = require('./middleware/authMiddleware');
const maintenanceCheck = require('./middleware/maintenanceMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Fix BigInt serialization
BigInt.prototype.toJSON = function () { return this.toString(); };

// Trust proxy — HARUS di paling atas sebelum session middleware
// Vercel menggunakan reverse proxy, tanpa ini cookie secure tidak dikirim
app.set('trust proxy', 1);

// Middleware dasar
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ====== SESSION (database-backed) ======

// Pilih URL koneksi untuk session store:
// - Gunakan SESSION_DATABASE_URL jika ada (khusus session store)
// - Fallback ke DIRECT_URL
// - Fallback terakhir ke DATABASE_URL (tanpa ?pgbouncer=true)
function getSessionConnectionUrl() {
    if (process.env.SESSION_DATABASE_URL) return process.env.SESSION_DATABASE_URL;
    if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
    // Strip ?pgbouncer=true karena connect-pg-simple butuh koneksi langsung
    const dbUrl = process.env.DATABASE_URL || '';
    return dbUrl.replace('?pgbouncer=true', '');
}

const sessionConnUrl = getSessionConnectionUrl();
console.log('[Session] Connecting to:', sessionConnUrl.replace(/:[^:@]+@/, ':***@')); // Log URL tanpa password

const sessionStore = new pgSession({
    conString: sessionConnUrl,
    tableName: 'session',
    createTableIfMissing: true,
    // Timeout koneksi agar tidak hang
    pool: {
        connectionTimeoutMillis: 10000,
        max: 5
    }
});

// Error handler — agar error DB muncul di Vercel Logs
sessionStore.on('error', (error) => {
    console.error('SESSION_STORE_ERROR:', error);
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fallback-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 jam
    }
}));

// Auth & Admin routes (harus bisa diakses meski maintenance ON)
app.use(authRoutes);
app.use(adminRoutes);
app.use(uploadRoutes);

// Maintenance page route (sebelum middleware agar tidak redirect loop)
app.get('/maintenance', (req, res) => res.sendFile(path.join(__dirname, 'public', 'maintenance.html')));

// Admin panel (auth-protected, bypass maintenance lewat session check di middleware)
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index3.html')));

// ====== MAINTENANCE MIDDLEWARE ======
app.use(maintenanceCheck);

// Intercept akses langsung ke file index3.html
app.use((req, res, next) => {
    if (req.path === '/index3.html') {
        return requireAuth(req, res, next);
    }
    next();
});

// Static files (di bawah maintenance check, tapi middleware skip file statis)
app.use(express.static(path.join(__dirname, 'public')));

// Gallery API & Public routes (terdampak maintenance)
app.use(galleryRoutes);
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
});
server.timeout = 300000; // 5 menit

module.exports = app;