const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/login', authController.loginPage);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/api/validate-password', authController.validatePassword);
router.post('/api/change-password', requireAuth, authController.changePassword);
router.post('/api/change-pin', requireAuth, authController.changePin);

module.exports = router;