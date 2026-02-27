const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { requireAuth } = require('../middleware/authMiddleware');

// Personals
router.get('/api/personals', galleryController.getPersonals);
router.get('/api/personals/:id', galleryController.getPersonalById);
router.post('/api/personals', requireAuth, galleryController.createPersonal);
router.put('/api/personals/:id', requireAuth, galleryController.updatePersonal);
router.delete('/api/personals/:id', requireAuth, galleryController.deletePersonal);

// Comission Works
router.get('/api/comission_works', galleryController.getComissions);
router.get('/api/comission_works/:id', galleryController.getComissionById);
router.post('/api/comission_works', requireAuth, galleryController.createComission);
router.put('/api/comission_works/:id', requireAuth, galleryController.updateComission);
router.delete('/api/comission_works/:id', requireAuth, galleryController.deleteComission);

module.exports = router;