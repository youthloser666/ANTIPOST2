require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { Readable } = require('stream');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Fix BigInt serialization (Pindahkan ke atas agar aktif sebelum route dipanggil)
BigInt.prototype.toJSON = function() { return this.toString(); };

// ==================== 1. Middleware & Static Files ====================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// --- AUTHENTICATION MIDDLEWARE START ---
const sessions = new Map(); // Ubah Set ke Map untuk menyimpan timestamp
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 menit dalam milidetik

// Helper untuk baca cookie
const parseCookies = (request) => {
    const list = {}, rc = request.headers.cookie;
    rc && rc.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
};

// Middleware Pengecekan
const requireAuth = (req, res, next) => {
    const cookies = parseCookies(req);
    const sessionId = cookies.session_id;

    if (sessionId && sessions.has(sessionId)) {
        const lastActivity = sessions.get(sessionId);
        const now = Date.now();

        if (now - lastActivity > SESSION_TIMEOUT) {
            sessions.delete(sessionId); // Hapus sesi dari server
            res.setHeader('Set-Cookie', 'session_id=; HttpOnly; Path=/; Max-Age=0'); // Hapus cookie di browser
            return res.redirect('/login?error=timeout');
        }

        // Update waktu aktivitas terakhir (Rolling Session)
        sessions.set(sessionId, now);
        return next();
    }
    res.redirect('/login');
};

// Intercept akses langsung ke file index3.html (jika user mengetik /index3.html di browser)
app.use((req, res, next) => {
    if (req.path === '/index3.html') {
        return requireAuth(req, res, next);
    }
    next();
});

// Route Login
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/login', async (req, res) => {
    const { password, pin } = req.body;
    
    try {
        // Ambil data admin dari database
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        
        if (admins.length > 0) {
            const admin = admins[0];
            // Bandingkan password dan PIN dengan hash di database
            const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
            const isPinValid = await bcrypt.compare(pin, admin.pin_hash);

            if (isPasswordValid && isPinValid) {
                const sessionId = crypto.randomBytes(16).toString('hex');
                sessions.set(sessionId, Date.now()); // Simpan waktu login
                res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; Path=/; Max-Age=86400`);
                return res.redirect('/admin');
            }
        }
    } catch (error) {
        console.error("Login Error:", error);
    }
    res.redirect('/login?error=1');
});

app.post('/api/validate-password', async (req, res) => {
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
});

app.post('/api/change-password', requireAuth, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    
    try {
        // 1. Ambil data admin
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        if (admins.length === 0) return res.status(404).json({ success: false, message: 'Admin config not found' });
        
        const admin = admins[0];

        // 2. Cek password lama
        const match = await bcrypt.compare(oldPassword, admin.password_hash);
        if (!match) return res.json({ success: false, message: 'Password lama salah' });

        // 3. Hash password baru & Update DB
        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.$executeRaw`UPDATE admin_config SET password_hash = ${newHash} WHERE id = ${admin.id}`;
        
        res.json({ success: true });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/change-pin', requireAuth, async (req, res) => {
    const { oldPin, newPin } = req.body;
    
    try {
        // 1. Ambil data admin
        const admins = await prisma.$queryRaw`SELECT * FROM admin_config LIMIT 1`;
        if (admins.length === 0) return res.status(404).json({ success: false, message: 'Admin config not found' });
        
        const admin = admins[0];

        // 2. Cek PIN lama
        const match = await bcrypt.compare(oldPin, admin.pin_hash);
        if (!match) return res.json({ success: false, message: 'PIN lama salah' });

        // 3. Hash PIN baru & Update DB
        const newHash = await bcrypt.hash(newPin, 10);
        await prisma.$executeRaw`UPDATE admin_config SET pin_hash = ${newHash} WHERE id = ${admin.id}`;
        
        res.json({ success: true });
    } catch (error) {
        console.error("Change PIN Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// --- AUTHENTICATION MIDDLEWARE END ---

// --- API Admin Stats ---
app.get('/api/admin/stats', requireAuth, async (req, res) => {
    try {
        const [pCount, cwCount, pRecent, cwRecent] = await Promise.all([
            prisma.personals.count().catch(() => 0),
            prisma.comission_works.count().catch(() => 0),
            prisma.personals.findMany({ take: 5, orderBy: { id: 'desc' } }),
            prisma.comission_works.findMany({ take: 5, orderBy: { id: 'desc' } })
        ]);
        res.json({
            counts: { personals: pCount, comission_works: cwCount },
            recent: { personals: pRecent, comission_works: cwRecent }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Watermark Config ---
app.get('/api/wm-config', async (req, res) => {
    try {
        const admins = await prisma.$queryRaw`SELECT wm_text FROM admin_config LIMIT 1`;
        if (admins.length > 0) {
            res.json({ wm_text: admins[0].wm_text || '' });
        } else {
            res.json({ wm_text: '' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/update-wm', requireAuth, async (req, res) => {
    const { wm_text } = req.body;
    try {
        // Update baris pertama di admin_config
        await prisma.$executeRaw`UPDATE admin_config SET wm_text = ${wm_text} WHERE id = (SELECT id FROM admin_config LIMIT 1)`;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/bulk-delete', requireAuth, async (req, res) => {
    const { ids, category } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Tidak ada ID yang dipilih' });
    }

    const table = category === 'personal' ? 'personals' : 'comission_works';

    try {
        // 1. Ambil data dulu untuk mendapatkan public_id (hapus gambar di Cloudinary)
        const items = await prisma[table].findMany({
            where: { id: { in: ids.map(Number) } }
        });

        for (const item of items) {
            if (item.public_id) await cloudinary.uploader.destroy(item.public_id);
        }

        // 2. Hapus data dari database
        const result = await prisma[table].deleteMany({
            where: { id: { in: ids.map(Number) } }
        });

        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error("Bulk Delete Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// ==================== 2. Konfigurasi Cloudinary ====================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Limit 100MB Explicit
});

// ==================== 3. Routes Halaman HTML ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/tambah', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index2.html')));

// Proteksi route /admin dengan middleware requireAuth
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index3.html')));

app.get('/logout', (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.session_id) sessions.delete(cookies.session_id);
    res.setHeader('Set-Cookie', 'session_id=; HttpOnly; Path=/; Max-Age=0');
    res.redirect('/login');
});

// ==================== 4. API Routes (Data) ====================

// Endpoint Config untuk Frontend
app.get('/api/config', (req, res) => {
    res.json({
        cloudName: process.env.CLOUD_NAME,
        uploadPreset: process.env.UPLOAD_PRESET || 'ml_default', // Fallback ke ml_default
        apiKey: process.env.API_KEY
    });
});

// --- Rute Upload Tunggal (Digunakan index2 & index3) ---
app.post('/upload', (req, res, next) => {
    // Log ukuran file yang masuk untuk debugging
    const sizeMB = (req.headers['content-length'] / 1024 / 1024).toFixed(2);
    console.log(`[Upload] Incoming request. Size: ${sizeMB} MB`);

    // Bungkus upload.single dalam fungsi untuk menangkap error
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error("[Upload] Middleware Error:", err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ error: 'File terlalu besar! Batas maksimal 100MB.' });
                }
                return res.status(400).json({ error: `Multer Error: ${err.message}` });
            }
            return res.status(500).json({ error: `Upload Error: ${err.message}` });
        }
        next();
    });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    try {
        // Proses gambar dengan Sharp
        const processedBuffer = await sharp(req.file.buffer)
            .resize({ width: 2000, withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toBuffer();

        // Upload ke Cloudinary via Stream
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'portofolio_kita' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            const stream = new Readable();
            stream.push(processedBuffer);
            stream.push(null);
            stream.pipe(uploadStream);
        });

        res.json({ imageUrl: result.secure_url, public_id: result.public_id });
    } catch (error) {
        console.error("[Upload] Processing Error:", error);
        res.status(500).json({ error: `Processing Error: ${error.message}` });
    }
});

// --- API Personals (Halaman Admin) ---

// Get All
app.get('/api/personals', async (req, res) => {
    try {
        const data = await prisma.personals.findMany({ orderBy: { id: 'desc' } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Detail (Dibutuhkan saat tombol EDIT diklik)
app.get('/api/personals/:id', async (req, res) => {
    try {
        const data = await prisma.personals.findUnique({
            where: { id: Number(req.params.id) }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create
app.post('/api/personals', async (req, res) => {
    try {
        const { name, description, image_path, public_id } = req.body;
        
        // Audit: Log data yang akan di-insert untuk debugging
        console.log("Inserting Personal:", { name, image_path, public_id });

        const result = await prisma.personals.create({
            data: { name, description, image_path, public_id }
        });
        res.json(result);
    } catch (error) {
        // Audit: Log error object secara lengkap (jangan pakai + error)
        console.error("Error Detail:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update (Dibutuhkan saat tombol UPDATE diklik)
app.put('/api/personals/:id', async (req, res) => {
    try {
        const { name, description, image_path, public_id } = req.body;
        const result = await prisma.personals.update({
            where: { id: Number(req.params.id) },
            data: { name, description, image_path, public_id }
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete (Dibutuhkan saat tombol DELETE diklik)
app.delete('/api/personals/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.personals.findUnique({ where: { id } });
        if (item?.public_id) {
            await cloudinary.uploader.destroy(item.public_id);
        }
        await prisma.personals.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Comission Works ---
app.get('/api/comission_works', async (req, res) => {
    try {
        const data = await prisma.comission_works.findMany({ orderBy: { id: 'desc' } });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/comission_works/:id', async (req, res) => {
    try {
        const data = await prisma.comission_works.findUnique({
            where: { id: Number(req.params.id) }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/comission_works', async (req, res) => {
    try {
        const { title, description, image_path, public_id } = req.body;
        const created = await prisma.comission_works.create({
            data: { title, description, image_path, public_id }
        });
        res.json({ success: true, data: created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// --- API Edit Comission Works ---
app.put('/api/comission_works/:id', async (req, res) => {
    try {
        const { title, description, image_path, public_id } = req.body;
        const updated = await prisma.comission_works.update({
            where: { id: parseInt(req.params.id) },
            data: { title, description, image_path, public_id }
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Hapus Comission Works ---
app.delete('/api/comission_works/:id', async (req, res) => {
    try {
        await prisma.comission_works.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true, message: 'Berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Ambil Satu Data Comission (Untuk Form Edit) ---
app.get('/api/comission_works/:id', async (req, res) => {
    try {
        const data = await prisma.comission_works.findUnique({
            where: { id: parseInt(req.params.id) }
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/comission_works/:id', async (req, res) => {
    try {
        const { title, description, image_path, public_id } = req.body;
        const result = await prisma.comission_works.update({
            where: { id: Number(req.params.id) },
            data: { title, description, image_path, public_id }
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/comission_works/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.comission_works.findUnique({ where: { id } });
        if (item?.public_id) {
            await cloudinary.uploader.destroy(item.public_id);
        }
        await prisma.comission_works.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 5. Helper & Final Touch ====================

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
});
server.timeout = 300000; // Set timeout 5 menit untuk upload file besar

module.exports = app;