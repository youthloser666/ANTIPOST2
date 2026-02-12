require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// ==================== Middleware Setup (HARUS DI AWAL!) ====================
app.use(express.json()); // Parse JSON body PERTAMA
app.use(express.urlencoded({ extended: true }));

// ==================== Konfigurasi Cloudinary ====================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// Setting tempat simpan Multer ke Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'portofolio_kita',
        allowed_formats: ['jpg', 'png', 'webp'],
    },
});

const upload = multer({ storage: storage });

const fs = require('fs');


// ==================== API Routes ====================

// Get Cloudinary Config
app.get('/api/config', (req, res) => {
    const config = {
        cloudName: process.env.CLOUD_NAME,
        uploadPreset: process.env.UPLOAD_PRESET,
        apiKey: process.env.API_KEY
    };
    
    console.log('📋 Config requested:', {
        cloudName: config.cloudName ? '✅ Set' : '❌ NOT SET',
        uploadPreset: config.uploadPreset ? '✅ Set' : '⚠️ Not Set',
        hasApiKey: config.apiKey ? '✅ Set' : '❌ Not Set'
    });
    
    if (!config.cloudName) {
        return res.status(400).json({ 
            error: 'CLOUD_NAME tidak ditemukan di .env file',
            availableEnvVars: {
                CLOUD_NAME: process.env.CLOUD_NAME ? 'SET' : 'NOT SET',
                UPLOAD_PRESET: process.env.UPLOAD_PRESET ? 'SET' : 'NOT SET',
                API_KEY: process.env.API_KEY ? 'SET' : 'NOT SET',
                DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET'
            }
        });
    }
    
    res.json(config);
});

// Upload Endpoint (Backend to Cloudinary)
app.post('/upload', upload.single('image'), (req, res) => {
    try {
        // multer-storage-cloudinary exposes file info; filename usually holds public_id
        const publicId = req.file && (req.file.filename || req.file.public_id || null);

        res.json({
            message: "Upload Sukses!",
            imageUrl: req.file.path,
            public_id: publicId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Personals
app.get('/api/personals', async (req, res) => {
    try {
        const data = await prisma.personals.findMany(); 
        
        // Normalisasi image_path
        const processedData = data.map(item => {
            if (item.image_path) {
                let imgPath = item.image_path.trim();
                
                if (imgPath.startsWith('http')) {
                    return { ...item, image_path: imgPath };
                }
                
                if (imgPath.startsWith('personals/')) {
                    imgPath = imgPath.substring(10);
                }
                
                return { ...item, image_path: imgPath };
            }
            return item;
        });
        
        res.json(processedData);
    } catch (error) {
        console.error('❌ Error fetching personals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create New Personal
app.post('/api/personals', async (req, res) => {
    try {
        const { name, image_path, description, public_id } = req.body;

        if (!name || !image_path) {
            return res.status(400).json({ error: 'Name dan image_path diperlukan' });
        }

        const newPersonal = await prisma.personals.create({
            data: {
                name: name,
                image_path: image_path,
                public_id: public_id || null,
                description: description || null
            }
        });

        console.log('✅ Personal created:', newPersonal.id);
        res.json({
            success: true,
            message: 'Data berhasil disimpan',
            data: newPersonal
        });
    } catch (error) {
        console.error('❌ Error creating personal:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single Personal by id
app.get('/api/personals/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const item = await prisma.personals.findUnique({
            where: { id: Number(id) }
        });

        if (!item) return res.status(404).json({ error: 'Not found' });

        res.json(item);
    } catch (error) {
        console.error('❌ Error fetching personal:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Personal (optional image upload)
app.put('/api/personals/:id', upload.single('image'), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description, public_id } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description || null;
        if (req.file && req.file.path) updateData.image_path = req.file.path;
        // If multer returned a new public id, use it; else accept public_id from body
        const newPublicId = req.file && (req.file.filename || req.file.public_id);
        if (newPublicId) updateData.public_id = newPublicId;
        else if (public_id) updateData.public_id = public_id;

        const updated = await prisma.personals.update({
            where: { id: Number(id) },
            data: updateData
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('❌ Error updating personal:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Personal
app.delete('/api/personals/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Find item first to get public_id
        const item = await prisma.personals.findUnique({ where: { id: Number(id) } });
        if (!item) return res.status(404).json({ error: 'Not found' });

        if (item.public_id) {
            try {
                // public_id might include extension or folder; strip extension if present
                let pid = item.public_id;
                // remove extension if present
                pid = pid.replace(/\.[a-zA-Z0-9]{1,5}$/,'');
                console.log('🔐 Deleting Cloudinary resource:', pid);
                cloudinary.uploader.destroy(pid, {invalidate: true}, (err, result) => {
                    if (err) console.error('❌ Cloudinary delete error:', err);
                    else console.log('✅ Cloudinary delete result:', result);
                });
            } catch (err) {
                console.error('❌ Error deleting from Cloudinary:', err);
            }
        }

        await prisma.personals.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting personal:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== Static Files (SETELAH Routes!) ====================

app.use(express.static('public')); // Serve public folder
app.use('/images', express.static(path.join(__dirname, 'public/images'))); // Serve images

// Fix BigInt serialization
BigInt.prototype.toJSON = function() {
  return this.toString();
};

// ==================== Start Server ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server jalan di http://localhost:${PORT}`);
    console.log(`📸 Dashboard: http://localhost:${PORT}/`);
    console.log(`\n✅ Konfigurasi:`);
    console.log(`   • CLOUD_NAME: ${process.env.CLOUD_NAME ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   • API_KEY: ${process.env.API_KEY ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   • API_SECRET: ${process.env.API_SECRET ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   • DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   • UPLOAD_PRESET: ${process.env.UPLOAD_PRESET || '⚠️ Not Set'}`);
    console.log(`\n💡 Buka http://localhost:${PORT} di browser\n`);
});

// List available images for comission_works (from public/images/comission_works)
app.get('/api/comission_images', (req, res) => {
    try {
        const dir = path.join(__dirname, 'public/images/comission_works');
        if (!fs.existsSync(dir)) return res.json([]);
        const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
        res.json(files);
    } catch (err) {
        console.error('❌ Error reading comission images:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all comission_works
app.get('/api/comission_works', async (req, res) => {
    try {
        const data = await prisma.comission_works.findMany();
        res.json(data);
    } catch (error) {
        console.error('❌ Error fetching comission_works:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single comission_work
app.get('/api/comission_works/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const item = await prisma.comission_works.findUnique({ where: { id: Number(id) } });
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json(item);
    } catch (error) {
        console.error('❌ Error fetching comission_work:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create comission_work
app.post('/api/comission_works', async (req, res) => {
    try {
        const { title, description, image_path, public_id } = req.body;
        if (!title) return res.status(400).json({ error: 'Title required' });
        const created = await prisma.comission_works.create({ data: { title, description: description || null, image_path: image_path || null, public_id: public_id || null } });
        res.json({ success: true, data: created });
    } catch (error) {
        console.error('❌ Error creating comission_work:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update comission_work
app.put('/api/comission_works/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { title, description, image_path, public_id } = req.body;
        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description || null;
        if (image_path !== undefined) updateData.image_path = image_path || null;
        if (public_id !== undefined) updateData.public_id = public_id || null;
        const updated = await prisma.comission_works.update({ where: { id: Number(id) }, data: updateData });
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('❌ Error updating comission_work:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete comission_work
app.delete('/api/comission_works/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Find item first to get public_id
        const item = await prisma.comission_works.findUnique({ where: { id: Number(id) } });
        if (!item) return res.status(404).json({ error: 'Not found' });

        // Delete from Cloudinary if public_id exists
        if (item.public_id) {
            try {
                let pid = item.public_id;
                // Remove extension if present
                pid = pid.replace(/\.[a-zA-Z0-9]{1,5}$/, '');
                console.log('🔐 Deleting Cloudinary resource:', pid);
                cloudinary.uploader.destroy(pid, { invalidate: true }, (err, result) => {
                    if (err) console.error('❌ Cloudinary delete error:', err);
                    else console.log('✅ Cloudinary delete result:', result);
                });
            } catch (err) {
                console.error('❌ Error deleting from Cloudinary:', err);
            }
        }

        await prisma.comission_works.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting comission_work:', error);
        res.status(500).json({ error: error.message });
    }
});