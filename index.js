require('dotenv').config();
const express = require('express');
const path = require('path');
const { requireAuth } = require('./middleware/authMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Fix BigInt serialization
BigInt.prototype.toJSON = function() { return this.toString(); };

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Intercept akses langsung ke file index3.html (jika user mengetik /index3.html di browser)
app.use((req, res, next) => {
    if (req.path === '/index3.html') {
        return requireAuth(req, res, next);
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Routes Usage
app.use(authRoutes);
app.use(galleryRoutes);
app.use(adminRoutes);

// Static HTML Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index3.html')));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
});
server.timeout = 300000; // 5 menit

module.exports = app;