require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const app = express();
const prisma = new PrismaClient();

// ==================== 1. Middleware & Static Files ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan folder public secara statis agar CSS dan HTML terbaca
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tambah', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index2.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index3.html'));
});

// ==================== 4. API Routes (Data) ====================

// --- KHUSUS UPLOAD (Dibutuhkan oleh index2.html) ---
app.post('/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
        }
        // Mengirim balik path dan filename (public_id) ke frontend
        res.json({
            message: "Upload Sukses!",
            imageUrl: req.file.path,
            public_id: req.file.filename 
        });
    } catch (err) {
        console.error('❌ Upload Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Comission Works Routes ---
app.get('/api/comission_works', async (req, res) => {
    try {
        const data = await prisma.comission_works.findMany({
            orderBy: { id: 'desc' } // Agar data terbaru di atas
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
            data: { 
                title, 
                description: description || "", 
                image_path, 
                public_id 
            }
        });
        res.json({ success: true, data: created });
    } catch (error) {
        console.error('❌ DB Save Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/comission_works/:id', async (req, res) => {
    try {
        const item = await prisma.comission_works.findUnique({
            where: { id: Number(req.params.id) }
        });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/comission_works/:id', async (req, res) => {
    try {
        const { title, description } = req.body;
        const updated = await prisma.comission_works.update({
            where: { id: Number(req.params.id) },
            data: { title, description }
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/comission_works/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const item = await prisma.comission_works.findUnique({ where: { id } });
        
        if (item?.public_id) {
            // Hapus gambar di Cloudinary
            await cloudinary.uploader.destroy(item.public_id);
        }
        
        await prisma.comission_works.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Personals Routes (Optional) ---
app.get('/api/personals', async (req, res) => {
    try {
        const data = await prisma.personals.findMany();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 5. Helper & Final Touch ====================

BigInt.prototype.toJSON = function() {
  return this.toString();
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
});

module.exports = app;