const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../config/constants');
const { logAction } = require('../services/auditService');

/**
 * Toggle driver shift online/offline
 */
async function toggleShift(req, res, next) {
  try {
    const driverId = req.user.id;
    const { isShiftActive, currentLat, currentLng } = req.body;

    if (isDbConnected() && prisma) {
      try {
        const profile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
        if (!profile) return res.status(404).json({ success: false, error: 'Driver profile not found' });

        if (profile.kycStatus !== 'APPROVED') {
          return res.status(403).json({
            success: false,
            error: `KYC verification status: ${profile.kycStatus}. Only approved drivers can start shifts.`
          });
        }

        const updated = await prisma.driverProfile.update({
          where: { userId: driverId },
          data: {
            isShiftActive: Boolean(isShiftActive),
            isAvailable: Boolean(isShiftActive),
            ...(currentLat ? { currentLat: Number(currentLat) } : {}),
            ...(currentLng ? { currentLng: Number(currentLng) } : {}),
            lastLocationUpdate: new Date()
          }
        });

        await logAction({
          actorId: driverId,
          actorRole: 'DRIVER',
          action: isShiftActive ? 'DRIVER_SHIFT_STARTED' : 'DRIVER_SHIFT_ENDED',
          entityType: 'DriverProfile',
          entityId: profile.id
        });

        const io = req.app.get('io');
        if (io) {
          io.to('admin_dispatch').emit('dispatch:driver_shift_toggled', {
            driverId,
            isShiftActive: Boolean(isShiftActive),
            isAvailable: Boolean(isShiftActive)
          });
        }

        return res.json({
          success: true,
          message: isShiftActive ? 'You are now ONLINE and ready for trips.' : 'You are now OFFLINE.',
          profile: updated
        });
      } catch (err) {
        console.warn('[DriverController] Fallback to memory for toggleShift:', err.message);
      }
    }

    // Memory Store
    let dp = memoryStore.driverProfiles.find(d => d.userId === driverId);
    if (!dp) {
      dp = {
        id: `dp-${Date.now()}`,
        userId: driverId,
        licenseNumber: 'TN57-TEMP-001',
        kycStatus: 'APPROVED',
        isShiftActive: false,
        isAvailable: false,
        currentLat: 10.3673,
        currentLng: 77.9803,
        lastLocationUpdate: new Date(),
        rating: 5.0,
        totalTrips: 0,
        assignedVehicleId: 'veh-1'
      };
      memoryStore.driverProfiles.push(dp);
    }

    dp.isShiftActive = Boolean(isShiftActive);
    dp.isAvailable = Boolean(isShiftActive);
    if (currentLat) dp.currentLat = Number(currentLat);
    if (currentLng) dp.currentLng = Number(currentLng);
    dp.lastLocationUpdate = new Date();

    const io = req.app.get('io');
    if (io) {
      io.to('admin_dispatch').emit('dispatch:driver_shift_toggled', {
        driverId,
        isShiftActive: dp.isShiftActive,
        isAvailable: dp.isAvailable
      });
    }

    return res.json({
      success: true,
      message: dp.isShiftActive ? 'You are now ONLINE and ready for trips.' : 'You are now OFFLINE.',
      profile: dp
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get assigned trips and history for authenticated driver
 */
async function getMyTrips(req, res, next) {
  try {
    const driverId = req.user.id;

    if (isDbConnected() && prisma) {
      try {
        const trips = await prisma.booking.findMany({
          where: { driverId },
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            vehicle: true,
            payments: true
          }
        });
        return res.json({ success: true, trips });
      } catch (err) {
        console.warn('[DriverController] Fallback to memory for trips:', err.message);
      }
    }

    const trips = memoryStore.bookings
      .filter(b => b.driverId === driverId)
      .map(b => ({
        ...b,
        customer: memoryStore.users.find(u => u.id === b.customerId),
        vehicle: memoryStore.vehicles.find(v => v.id === b.vehicleId),
        payments: memoryStore.payments.filter(p => p.bookingId === b.id)
      }));

    return res.json({ success: true, trips });
  } catch (error) {
    next(error);
  }
}

/**
 * Update trip status (ARRIVED, START TRIP WITH OTP, COMPLETE TRIP)
 */
async function updateTripStatus(req, res, next) {
  try {
    const driverId = req.user.id;
    const { bookingId } = req.params;
    const { status, otpCode, cancellationReason } = req.body;
    const io = req.app.get('io');

    let booking;
    if (isDbConnected() && prisma) {
      try {
        booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { customer: true, vehicle: true }
        });
      } catch (e) {
        booking = memoryStore.bookings.find(b => b.id === bookingId);
      }
    } else {
      booking = memoryStore.bookings.find(b => b.id === bookingId);
    }

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.driverId !== driverId && req.user.role !== 'ADMIN' && req.user.role !== 'DISPATCHER') {
      return res.status(403).json({ success: false, error: 'You are not assigned to this trip.' });
    }

    // Status transition validation
    if (status === BOOKING_STATUS.TRIP_STARTED) {
      // Validate OTP
      if (!otpCode || otpCode.trim() !== booking.otpCode.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Incorrect OTP code. Ask customer for the 4-digit ride OTP.'
        });
      }
    }

    // Complete trip adjustments
    let finalFare = booking.estimatedFare;
    if (status === BOOKING_STATUS.COMPLETED) {
      finalFare = booking.finalFare || booking.estimatedFare;
    }

    // Apply database updates
    let updatedBooking;
    if (isDbConnected() && prisma) {
      try {
        updatedBooking = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status,
            finalFare,
            ...(cancellationReason ? { cancellationReason, cancelledBy: 'DRIVER' } : {})
          },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            driver: { select: { id: true, name: true, phone: true } },
            vehicle: true,
            payments: true
          }
        });

        // If completed or cancelled, make driver available again
        if (status === BOOKING_STATUS.COMPLETED || status === BOOKING_STATUS.CANCELLED) {
          await prisma.driverProfile.updateMany({
            where: { userId: driverId },
            data: {
              isAvailable: true,
              ...(status === BOOKING_STATUS.COMPLETED ? { totalTrips: { increment: 1 } } : {})
            }
          });
        }
      } catch (err) {
        console.warn('[DriverController] Fallback update in memory:', err.message);
      }
    }

    if (!updatedBooking) {
      booking.status = status;
      booking.finalFare = finalFare;
      booking.updatedAt = new Date();
      if (cancellationReason) {
        booking.cancellationReason = cancellationReason;
        booking.cancelledBy = 'DRIVER';
      }

      if (status === BOOKING_STATUS.COMPLETED || status === BOOKING_STATUS.CANCELLED) {
        const dp = memoryStore.driverProfiles.find(d => d.userId === driverId);
        if (dp) {
          dp.isAvailable = true;
          if (status === BOOKING_STATUS.COMPLETED) dp.totalTrips += 1;
        }
      }

      updatedBooking = {
        ...booking,
        customer: memoryStore.users.find(u => u.id === booking.customerId),
        driver: memoryStore.users.find(u => u.id === booking.driverId),
        vehicle: memoryStore.vehicles.find(v => v.id === booking.vehicleId),
        payments: memoryStore.payments.filter(p => p.bookingId === booking.id)
      };
    }

    await logAction({
      actorId: driverId,
      actorRole: 'DRIVER',
      action: `TRIP_STATUS_${status}`,
      entityType: 'Booking',
      entityId: bookingId,
      details: { status, finalFare }
    });

    // Real-time broadcasts
    if (io) {
      io.to(`booking_${bookingId}`).emit('booking:status_update', updatedBooking);
      io.to(`customer_${booking.customerId}`).emit('booking:status_update', updatedBooking);
      io.to('admin_dispatch').emit('dispatch:booking_updated', updatedBooking);
    }

    return res.json({
      success: true,
      message: `Trip status updated to ${status}.`,
      booking: updatedBooking
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Driver earnings and trip stats
 */
async function getEarningsSummary(req, res, next) {
  try {
    const driverId = req.user.id;

    let trips = [];
    if (isDbConnected() && prisma) {
      try {
        trips = await prisma.booking.findMany({
          where: { driverId, status: BOOKING_STATUS.COMPLETED },
          include: { payments: true }
        });
      } catch (e) {
        trips = memoryStore.bookings.filter(b => b.driverId === driverId && b.status === BOOKING_STATUS.COMPLETED);
      }
    } else {
      trips = memoryStore.bookings.filter(b => b.driverId === driverId && b.status === BOOKING_STATUS.COMPLETED);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTrips = trips.filter(t => new Date(t.createdAt) >= todayStart);
    const todayEarnings = todayTrips.reduce((acc, t) => acc + (t.finalFare || t.estimatedFare), 0);
    const totalEarnings = trips.reduce((acc, t) => acc + (t.finalFare || t.estimatedFare), 0);

    return res.json({
      success: true,
      data: {
        todayTripsCount: todayTrips.length,
        todayEarnings: Math.round(todayEarnings),
        totalTripsCount: trips.length,
        totalEarnings: Math.round(totalEarnings),
        recentCompletedTrips: trips.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  toggleShift,
  getMyTrips,
  updateTripStatus,
  getEarningsSummary
};
