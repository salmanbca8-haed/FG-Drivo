const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/rbacMiddleware');

// Driver specific routes
router.post('/shift', authenticateToken, requireRole('DRIVER', 'ADMIN'), driverController.toggleShift);
router.get('/my-trips', authenticateToken, requireRole('DRIVER', 'ADMIN'), driverController.getMyTrips);
router.patch('/trips/:bookingId/status', authenticateToken, requireRole('DRIVER', 'ADMIN', 'DISPATCHER'), driverController.updateTripStatus);
router.get('/earnings', authenticateToken, requireRole('DRIVER'), driverController.getEarningsSummary);

module.exports = router;
