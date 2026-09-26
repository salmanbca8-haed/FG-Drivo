const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/rbacMiddleware');

// All admin routes require ADMIN or DISPATCHER role
router.use(authenticateToken);
router.use(requireRole('ADMIN', 'DISPATCHER'));

router.get('/metrics', adminController.getDashboardMetrics);
router.get('/dispatch/bookings', adminController.getDispatchBookings);
router.post('/dispatch/assign/:bookingId', adminController.assignDriver);

router.get('/fleet', adminController.getFleet);
router.post('/fleet', requireRole('ADMIN'), adminController.saveVehicle);

router.get('/drivers', adminController.getDrivers);
router.patch('/drivers/:driverId/kyc', requireRole('ADMIN'), adminController.updateDriverKyc);

router.get('/fares', adminController.getFareRules);
router.put('/fares/:category', requireRole('ADMIN'), adminController.updateFareRule);

router.get('/payments', adminController.getPaymentsLedger);
router.get('/audit-logs', requireRole('ADMIN'), adminController.getAuditLogsEndpoint);

module.exports = router;
