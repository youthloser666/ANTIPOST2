const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const upload = require('../middleware/uploadMiddleware');
const multer = require('multer');

// Upload Route
router.post('/upload', (req, res, next) => {
    const sizeMB = (req.headers['content-length'] / 1024 / 1024).toFixed(2);
    console.log(`[Upload] Incoming request. Size: ${sizeMB} MB`);
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
}, galleryController.uploadImage);

// Personals
router.get('/api/personals', galleryController.getPersonals);
router.get('/api/personals/:id', galleryController.getPersonalById);
router.post('/api/personals', galleryController.createPersonal);
router.put('/api/personals/:id', galleryController.updatePersonal);
router.delete('/api/personals/:id', galleryController.deletePersonal);

// Comission Works
router.get('/api/comission_works', galleryController.getComissions);
router.get('/api/comission_works/:id', galleryController.getComissionById);
router.post('/api/comission_works', galleryController.createComission);
router.put('/api/comission_works/:id', galleryController.updateComission);
router.delete('/api/comission_works/:id', galleryController.deleteComission);

module.exports = router;