require('dotenv').config();
const express = require('express');
const path = require('path');
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

// Middleware dasar
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Auth & Admin routes (harus bisa diakses meski maintenance ON)
app.use(authRoutes);
app.use(adminRoutes);
app.use(uploadRoutes);

// Maintenance page route (sebelum middleware agar tidak redirect loop)
app.get('/maintenance', (req, res) => res.sendFile(path.join(__dirname, 'public', 'maintenance.html')));

// Admin panel (auth-protected, bypass maintenance lewat session check di middleware)
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index3.html')));

// ====== MAINTENANCE MIDDLEWARE ======
// Posisi: DI ATAS express.static agar bisa intercept request ke "/"
// Logic di dalam middleware sudah handle skip file statis (.css, .js, .png, dll)
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