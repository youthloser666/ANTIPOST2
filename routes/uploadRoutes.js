const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/uploadMiddleware');
const multer = require('multer');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/upload', requireAuth, (req, res, next) => {
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
}, uploadController.uploadImage);

module.exports = router;
