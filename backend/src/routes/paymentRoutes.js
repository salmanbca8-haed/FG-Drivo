const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.post('/initiate', authenticateToken, paymentController.initiatePayment);
router.post('/verify', authenticateToken, paymentController.verifyPayment);
router.get('/receipt/:bookingId', authenticateToken, paymentController.getBookingPayment);

module.exports = router;
