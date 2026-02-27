const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/api/admin/stats', requireAuth, adminController.getStats);
router.get('/api/wm-config', adminController.getWmConfig);
router.post('/api/admin/update-wm', requireAuth, adminController.updateWmConfig);
router.delete('/api/admin/bulk-delete', requireAuth, adminController.bulkDelete);
router.get('/api/config', adminController.getConfig);
router.get('/api/admin/maintenance', requireAuth, adminController.getMaintenanceStatus);
router.put('/api/config', requireAuth, adminController.updateMaintenanceStatus);
router.get('/api/admin/session', requireAuth, adminController.getSession);

module.exports = router;