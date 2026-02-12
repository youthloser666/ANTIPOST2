require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// ==================== 1. Middleware & Static Files ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== 2. Konfigurasi Cloudinary ====================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'portofolio_kita',
        allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
    },
});

const upload = multer({ storage: storage });

// ==================== 3. Routes Halaman HTML ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/tambah', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index2.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index3.html')));

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
app.post('/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({
            imageUrl: req.file.path,
            public_id: req.file.filename 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        const result = await prisma.personals.create({
            data: { name, description, image_path, public_id }
        });
        res.json(result);
    } catch (error) {
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

// ==================== 5. Helper & Final Touch ====================
BigInt.prototype.toJSON = function() { return this.toString(); };

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
});

module.exports = app;