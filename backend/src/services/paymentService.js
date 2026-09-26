const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { PAYMENT_METHODS, PAYMENT_STATUS } = require('../config/constants');
const { logAction } = require('./auditService');
const crypto = require('crypto');

/**
 * Creates or updates a payment record for a booking
 */
async function createPaymentIntent({ bookingId, amount, method = PAYMENT_METHODS.CASH, notes = '' }) {
  const transactionRef = `${method}-FGD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  let upiDeepLink = null;
  let qrCodeData = null;

  if (method === PAYMENT_METHODS.UPI) {
    const vpa = process.env.UPI_MERCHANT_VPA || 'fgdrivo@okaxis';
    const name = encodeURIComponent(process.env.UPI_MERCHANT_NAME || 'FG DRIVO TAXI DINDIGUL');
    upiDeepLink = `upi://pay?pa=${vpa}&pn=${name}&am=${amount.toFixed(2)}&tr=${transactionRef}&tn=FG_DRIVO_Ride_${bookingId}&cu=INR`;
    qrCodeData = upiDeepLink;
  }

  const paymentData = {
    id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    bookingId,
    amount: Number(amount),
    method,
    status: PAYMENT_STATUS.PENDING,
    transactionRef,
    gatewayPaymentId: method === PAYMENT_METHODS.ONLINE ? `GATEWAY_${Date.now()}` : null,
    gatewaySignature: null,
    collectedBy: method === PAYMENT_METHODS.CASH ? 'DRIVER' : 'GATEWAY',
    notes,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  if (isDbConnected() && prisma) {
    try {
      const created = await prisma.payment.create({
        data: {
          bookingId,
          amount: Number(amount),
          method,
          status: PAYMENT_STATUS.PENDING,
          transactionRef,
          gatewayPaymentId: paymentData.gatewayPaymentId,
          notes,
          collectedBy: paymentData.collectedBy
        }
      });
      return {
        ...created,
        upiDeepLink,
        qrCodeData
      };
    } catch (err) {
      console.warn('[PaymentService] Fallback to memory for payment creation:', err.message);
    }
  }

  // Memory fallback
  // Remove existing pending payments for this booking
  memoryStore.payments = memoryStore.payments.filter(p => !(p.bookingId === bookingId && p.status === PAYMENT_STATUS.PENDING));
  memoryStore.payments.push(paymentData);

  return {
    ...paymentData,
    upiDeepLink,
    qrCodeData
  };
}

/**
 * Confirms and completes a payment (Cash received by driver or verified UPI/Online)
 */
async function confirmPayment({ bookingId, transactionRef = null, method = PAYMENT_METHODS.CASH, collectedBy = 'DRIVER', signature = null, actorId = null, io = null }) {
  let payment;

  if (isDbConnected() && prisma) {
    try {
      const existing = await prisma.payment.findFirst({
        where: {
          bookingId,
          ...(transactionRef ? { transactionRef } : {})
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!existing) {
        throw new Error('Payment record not found');
      }

      payment = await prisma.payment.update({
        where: { id: existing.id },
        data: {
          status: PAYMENT_STATUS.COMPLETED,
          collectedBy,
          gatewaySignature: signature || `SIG_${crypto.randomBytes(8).toString('hex')}`,
          updatedAt: new Date()
        },
        include: {
          booking: {
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              driver: { select: { id: true, name: true, phone: true } },
              vehicle: true
            }
          }
        }
      });

      await logAction({
        actorId,
        actorRole: collectedBy === 'DRIVER' ? 'DRIVER' : 'ADMIN',
        action: 'PAYMENT_CONFIRMED',
        entityType: 'Payment',
        entityId: payment.id,
        details: { bookingId, amount: payment.amount, method: payment.method, collectedBy }
      });

      if (io) {
        io.to(`booking_${bookingId}`).emit('payment:completed', payment);
      }

      return payment;
    } catch (err) {
      if (err.message.includes('not found')) throw err;
      console.warn('[PaymentService] Fallback to memory for payment confirmation:', err.message);
    }
  }

  // Memory fallback
  payment = memoryStore.payments.find(p => p.bookingId === bookingId && (transactionRef ? p.transactionRef === transactionRef : true));
  if (!payment) {
    // create and complete on the fly
    payment = {
      id: `pay-${Date.now()}`,
      bookingId,
      amount: 100,
      method,
      status: PAYMENT_STATUS.COMPLETED,
      transactionRef: `REC-${Date.now().toString().slice(-6)}`,
      gatewayPaymentId: `GW-${Date.now()}`,
      gatewaySignature: `SIG_${crypto.randomBytes(8).toString('hex')}`,
      collectedBy,
      notes: 'Payment settled',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.payments.push(payment);
  } else {
    payment.status = PAYMENT_STATUS.COMPLETED;
    payment.collectedBy = collectedBy;
    payment.gatewaySignature = signature || `SIG_${crypto.randomBytes(8).toString('hex')}`;
    payment.updatedAt = new Date();
  }

  await logAction({
    actorId,
    actorRole: collectedBy === 'DRIVER' ? 'DRIVER' : 'ADMIN',
    action: 'PAYMENT_CONFIRMED',
    entityType: 'Payment',
    entityId: payment.id,
    details: { bookingId, amount: payment.amount, method: payment.method, collectedBy }
  });

  const booking = memoryStore.bookings.find(b => b.id === bookingId);
  const enrichedPayment = {
    ...payment,
    booking: booking ? {
      ...booking,
      customer: memoryStore.users.find(u => u.id === booking.customerId),
      driver: memoryStore.users.find(u => u.id === booking.driverId),
      vehicle: memoryStore.vehicles.find(v => v.id === booking.vehicleId)
    } : null
  };

  if (io) {
    io.to(`booking_${bookingId}`).emit('payment:completed', enrichedPayment);
  }

  return enrichedPayment;
}

module.exports = {
  createPaymentIntent,
  confirmPayment
};
