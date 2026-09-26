const { createPaymentIntent, confirmPayment } = require('../services/paymentService');
const { prisma, memoryStore, isDbConnected } = require('../db/prisma');

/**
 * Initiate payment intent for a booking (UPI QR or Cash or Card)
 */
async function initiatePayment(req, res, next) {
  try {
    const { bookingId, amount, method, notes } = req.body;
    if (!bookingId || !amount || !method) {
      return res.status(400).json({ success: false, error: 'bookingId, amount, and method are required.' });
    }

    const payment = await createPaymentIntent({
      bookingId,
      amount: Number(amount),
      method,
      notes
    });

    return res.json({ success: true, payment });
  } catch (error) {
    next(error);
  }
}

/**
 * Complete and verify payment
 */
async function verifyPayment(req, res, next) {
  try {
    const { bookingId, transactionRef, method, signature } = req.body;
    const io = req.app.get('io');
    const collectedBy = req.user.role === 'DRIVER' ? 'DRIVER' : (req.user.role === 'ADMIN' ? 'ADMIN' : 'GATEWAY');

    const result = await confirmPayment({
      bookingId,
      transactionRef,
      method,
      collectedBy,
      signature,
      actorId: req.user.id,
      io
    });

    return res.json({
      success: true,
      message: 'Payment verified and confirmed successfully.',
      payment: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get payment receipt for booking
 */
async function getBookingPayment(req, res, next) {
  try {
    const { bookingId } = req.params;

    if (isDbConnected() && prisma) {
      try {
        const payment = await prisma.payment.findFirst({
          where: { bookingId },
          orderBy: { createdAt: 'desc' },
          include: { booking: true }
        });
        if (payment) return res.json({ success: true, payment });
      } catch (err) {
        // fallback
      }
    }

    const payment = memoryStore.payments.find(p => p.bookingId === bookingId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'No payment record found for this booking.' });
    }

    const booking = memoryStore.bookings.find(b => b.id === bookingId);
    return res.json({
      success: true,
      payment: {
        ...payment,
        booking
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  initiatePayment,
  verifyPayment,
  getBookingPayment
};
