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

// Sajikan folder public secara statis
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
        allowed_formats: ['jpg', 'png', 'webp'],
    },
});

const upload = multer({ storage: storage });

// ==================== 3. Routes Halaman HTML ====================

// Halaman Utama (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Halaman Tambah Data / Upload (index2.html)
// Akses: namaprojek.vercel.app/tambah
app.get('/tambah', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index2.html'));
});

// Halaman Admin / Management (index3.html)
// Akses: namaprojek.vercel.app/admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index3.html'));
});


// ==================== 4. API Routes (Data) ====================

app.get('/api/config', (req, res) => {
    res.json({
        cloudName: process.env.CLOUD_NAME,
        uploadPreset: process.env.UPLOAD_PRESET,
        apiKey: process.env.API_KEY
    });
});

// --- Personals Routes ---
app.get('/api/personals', async (req, res) => {
    try {
        const data = await prisma.personals.findMany();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/personals', upload.single('image'), async (req, res) => {
    try {
        const { name, description } = req.body;
        // Gunakan path dari cloudinary jika ada file, jika tidak pakai dari body
        const image_path = req.file ? req.file.path : req.body.image_path;
        const public_id = req.file ? req.file.filename : req.body.public_id;

        const newPersonal = await prisma.personals.create({
            data: { 
                name, 
                description, 
                image_path, 
                public_id: public_id || null 
            }
        });
        res.json({ success: true, data: newPersonal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/personals/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const item = await prisma.personals.findUnique({ where: { id: Number(id) } });
        if (item?.public_id) {
            await cloudinary.uploader.destroy(item.public_id.replace(/\.[a-zA-Z0-9]{1,5}$/,''));
        }
        await prisma.personals.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Comission Works Routes ---
app.get('/api/comission_works', async (req, res) => {
    try {
        const data = await prisma.comission_works.findMany();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/comission_works', upload.single('image'), async (req, res) => {
    try {
        const { title, description } = req.body;
        const image_path = req.file ? req.file.path : req.body.image_path;
        const public_id = req.file ? req.file.filename : req.body.public_id;

        const created = await prisma.comission_works.create({
            data: { title, description, image_path, public_id }
        });
        res.json({ success: true, data: created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 5. Helper & Final Touch ====================

// Fix BigInt serialization (Sangat krusial untuk Supabase)
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
});

// Export untuk Vercel agar tidak Error 500
module.exports = app;