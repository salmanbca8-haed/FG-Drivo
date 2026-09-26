const { v4: uuidv4 } = require('uuid');
const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { haversineDistance, validateWithinDindigulBoundary, estimateDurationMins } = require('../services/geoService');
const { calculateFare } = require('../services/fareEngine');
const { autoDispatch, cancelBooking } = require('../services/dispatchService');
const { createPaymentIntent } = require('../services/paymentService');
const { logAction } = require('../services/auditService');
const { BOOKING_STATUS, PAYMENT_METHODS } = require('../config/constants');

/**
 * Public Fare Estimator with Dindigul Boundary Check
 */
async function estimateFare(req, res, next) {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, category = 'SEDAN', rideTime } = req.body;

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return res.status(400).json({
        success: false,
        error: 'Both pickup and drop coordinates are required.'
      });
    }

    // Dindigul Service Boundary Validation
    const pickupCheck = validateWithinDindigulBoundary(Number(pickupLat), Number(pickupLng));
    const dropCheck = validateWithinDindigulBoundary(Number(dropLat), Number(dropLng));

    if (!pickupCheck.isValid) {
      return res.status(400).json({
        success: false,
        boundaryError: true,
        error: `Pickup location is outside Dindigul service boundary: ${pickupCheck.message}`
      });
    }

    if (!dropCheck.isValid) {
      return res.status(400).json({
        success: false,
        boundaryError: true,
        error: `Drop location is outside Dindigul service boundary: ${dropCheck.message}`
      });
    }

    const distanceKm = haversineDistance(Number(pickupLat), Number(pickupLng), Number(dropLat), Number(dropLng));
    const durationMins = estimateDurationMins(distanceKm);
    const fareDetails = await calculateFare({
      category,
      distanceKm,
      durationMins,
      rideTime: rideTime ? new Date(rideTime) : new Date()
    });

    return res.json({
      success: true,
      data: {
        distanceKm,
        durationMins,
        ...fareDetails,
        boundaryStatus: 'VERIFIED_DINDIGUL_SERVICE_ZONE'
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new Booking
 */
async function createBooking(req, res, next) {
  try {
    const customerId = req.user.id;
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropAddress,
      dropLat,
      dropLng,
      category,
      isScheduled = false,
      scheduledFor = null,
      paymentMethod = PAYMENT_METHODS.CASH
    } = req.validatedBody;

    // Validate Dindigul Boundary
    const pickupCheck = validateWithinDindigulBoundary(pickupLat, pickupLng);
    const dropCheck = validateWithinDindigulBoundary(dropLat, dropLng);

    if (!pickupCheck.isValid) {
      return res.status(400).json({
        success: false,
        error: `Pickup location is outside Dindigul service area: ${pickupCheck.message}`
      });
    }
    if (!dropCheck.isValid) {
      return res.status(400).json({
        success: false,
        error: `Drop location is outside Dindigul service area: ${dropCheck.message}`
      });
    }

    const distanceKm = haversineDistance(pickupLat, pickupLng, dropLat, dropLng);
    const durationMins = estimateDurationMins(distanceKm);
    const rideTime = isScheduled && scheduledFor ? new Date(scheduledFor) : new Date();

    const fare = await calculateFare({
      category,
      distanceKm,
      durationMins,
      rideTime
    });

    // Generate unique human-readable booking ref e.g. FGD-20260926-8912
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `FGD-${dateStr}-${randomSuffix}`;
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    let newBooking;
    const io = req.app.get('io');

    if (isDbConnected() && prisma) {
      try {
        newBooking = await prisma.booking.create({
          data: {
            bookingRef,
            customerId,
            status: BOOKING_STATUS.PENDING,
            pickupAddress,
            pickupLat,
            pickupLng,
            dropAddress,
            dropLat,
            dropLng,
            distanceKm,
            durationMins,
            category,
            isScheduled: Boolean(isScheduled),
            scheduledFor: isScheduled && scheduledFor ? new Date(scheduledFor) : null,
            baseFare: fare.baseFare,
            perKmRate: fare.perKmRate,
            estimatedFare: fare.estimatedFare,
            otpCode,
            fareRuleSnapshot: JSON.stringify(fare.fareRuleSnapshot)
          },
          include: {
            customer: { select: { id: true, name: true, phone: true } }
          }
        });

        // Create initial payment intent
        await createPaymentIntent({
          bookingId: newBooking.id,
          amount: fare.estimatedFare,
          method: paymentMethod
        });
      } catch (err) {
        console.warn('[BookingController] Fallback to memory create:', err.message);
      }
    }

    if (!newBooking) {
      // Memory Store fallback
      newBooking = {
        id: `bk-${Date.now()}-${randomSuffix}`,
        bookingRef,
        customerId,
        driverId: null,
        vehicleId: null,
        status: BOOKING_STATUS.PENDING,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropAddress,
        dropLat,
        dropLng,
        distanceKm,
        durationMins,
        category,
        isScheduled: Boolean(isScheduled),
        scheduledFor: isScheduled && scheduledFor ? new Date(scheduledFor) : null,
        baseFare: fare.baseFare,
        perKmRate: fare.perKmRate,
        estimatedFare: fare.estimatedFare,
        finalFare: fare.estimatedFare,
        otpCode,
        cancellationReason: null,
        cancelledBy: null,
        fareRuleSnapshot: JSON.stringify(fare.fareRuleSnapshot),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryStore.bookings.unshift(newBooking);

      await createPaymentIntent({
        bookingId: newBooking.id,
        amount: fare.estimatedFare,
        method: paymentMethod
      });
    }

    await logAction({
      actorId: customerId,
      actorRole: req.user.role,
      action: 'BOOKING_CREATED',
      entityType: 'Booking',
      entityId: newBooking.id,
      details: { bookingRef, category, estimatedFare: fare.estimatedFare }
    });

    // Notify Dispatcher Console via Socket.IO
    if (io) {
      io.to('admin_dispatch').emit('dispatch:new_booking', newBooking);
    }

    // Try auto-dispatch for immediate rides
    if (!isScheduled) {
      try {
        const autoAssigned = await autoDispatch({
          bookingId: newBooking.id,
          actorId: 'system_auto_dispatch',
          actorRole: 'SYSTEM',
          io
        });
        if (autoAssigned) {
          newBooking = autoAssigned;
        }
      } catch (dispatchErr) {
        console.log(`[AutoDispatch] No immediate driver matched: ${dispatchErr.message}`);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully!',
      booking: newBooking
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer's bookings
 */
async function getCustomerBookings(req, res, next) {
  try {
    const customerId = req.user.id;

    if (isDbConnected() && prisma) {
      try {
        const bookings = await prisma.booking.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          include: {
            driver: { select: { id: true, name: true, phone: true, profilePic: true } },
            vehicle: true,
            payments: true
          }
        });
        return res.json({ success: true, bookings });
      } catch (err) {
        console.warn('[BookingController] Fallback to memory for list:', err.message);
      }
    }

    const bookings = memoryStore.bookings
      .filter(b => b.customerId === customerId)
      .map(b => ({
        ...b,
        driver: b.driverId ? memoryStore.users.find(u => u.id === b.driverId) : null,
        vehicle: b.vehicleId ? memoryStore.vehicles.find(v => v.id === b.vehicleId) : null,
        payments: memoryStore.payments.filter(p => p.bookingId === b.id)
      }));

    return res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single booking by ID or reference
 */
async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    let booking;
    if (isDbConnected() && prisma) {
      try {
        booking = await prisma.booking.findFirst({
          where: {
            OR: [
              { id },
              { bookingRef: id }
            ]
          },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            driver: {
              select: {
                id: true,
                name: true,
                phone: true,
                profilePic: true,
                driverProfile: {
                  select: { rating: true, totalTrips: true, currentLat: true, currentLng: true }
                }
              }
            },
            vehicle: true,
            payments: true,
            locationLogs: {
              take: 20,
              orderBy: { recordedAt: 'desc' }
            }
          }
        });
      } catch (err) {
        console.warn('[BookingController] Fallback to memory single get:', err.message);
      }
    }

    if (!booking) {
      const memB = memoryStore.bookings.find(b => b.id === id || b.bookingRef === id);
      if (memB) {
        const dUser = memB.driverId ? memoryStore.users.find(u => u.id === memB.driverId) : null;
        const dProf = memB.driverId ? memoryStore.driverProfiles.find(dp => dp.userId === memB.driverId) : null;
        booking = {
          ...memB,
          customer: memoryStore.users.find(u => u.id === memB.customerId),
          driver: dUser ? {
            id: dUser.id,
            name: dUser.name,
            phone: dUser.phone,
            profilePic: dUser.profilePic,
            driverProfile: dProf
          } : null,
          vehicle: memB.vehicleId ? memoryStore.vehicles.find(v => v.id === memB.vehicleId) : null,
          payments: memoryStore.payments.filter(p => p.bookingId === memB.id),
          locationLogs: memoryStore.locationLogs.filter(l => l.bookingId === memB.id)
        };
      }
    }

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Permission check
    const isAuthorized =
      user.role === 'ADMIN' ||
      user.role === 'DISPATCHER' ||
      booking.customerId === user.id ||
      booking.driverId === user.id;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this booking' });
    }

    return res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a booking
 */
async function cancelBookingEndpoint(req, res, next) {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;
    const io = req.app.get('io');

    const result = await cancelBooking({
      bookingId: id,
      reason,
      cancelledBy: req.user.role,
      actorId: req.user.id,
      io
    });

    return res.json({
      success: true,
      message: 'Booking cancelled successfully.',
      booking: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  estimateFare,
  createBooking,
  getCustomerBookings,
  getBookingById,
  cancelBookingEndpoint
};
