const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validate, bookingSchema } = require('../middlewares/validationMiddleware');
const { authenticateToken, optionalAuth } = require('../middlewares/authMiddleware');
const { bookingLimiter } = require('../middlewares/rateLimiter');

// Public Fare Estimate
router.post('/estimate', bookingController.estimateFare);

// Authenticated Customer Bookings
router.post('/', authenticateToken, bookingLimiter, validate(bookingSchema), bookingController.createBooking);
router.get('/my-bookings', authenticateToken, bookingController.getCustomerBookings);
router.get('/:id', authenticateToken, bookingController.getBookingById);
router.post('/:id/cancel', authenticateToken, bookingController.cancelBookingEndpoint);

module.exports = router;
