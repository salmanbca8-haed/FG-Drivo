const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { BOOKING_STATUS } = require('../config/constants');
const { haversineDistance } = require('./geoService');
const { logAction } = require('./auditService');

/**
 * Finds eligible and available drivers for a given vehicle category and pickup location
 */
async function findEligibleDrivers({ category, pickupLat, pickupLng }) {
  if (isDbConnected() && prisma) {
    try {
      const activeDrivers = await prisma.driverProfile.findMany({
        where: {
          isShiftActive: true,
          isAvailable: true,
          kycStatus: 'APPROVED',
          assignedVehicle: {
            category: category,
            status: 'ACTIVE'
          }
        },
        include: {
          user: {
            select: { id: true, name: true, phone: true, profilePic: true }
          },
          assignedVehicle: true
        }
      });

      return activeDrivers.map(dp => {
        const distanceToPickup = (dp.currentLat && dp.currentLng)
          ? haversineDistance(dp.currentLat, dp.currentLng, pickupLat, pickupLng)
          : 2.5; // default estimate if GPS not calibrated yet
        return {
          driverId: dp.userId,
          driverName: dp.user.name,
          phone: dp.user.phone,
          profilePic: dp.user.profilePic,
          rating: dp.rating,
          totalTrips: dp.totalTrips,
          vehicleId: dp.assignedVehicleId,
          vehicleReg: dp.assignedVehicle ? dp.assignedVehicle.regNumber : 'N/A',
          vehicleModel: dp.assignedVehicle ? `${dp.assignedVehicle.make} ${dp.assignedVehicle.model}` : 'N/A',
          vehicleCategory: dp.assignedVehicle ? dp.assignedVehicle.category : category,
          currentLat: dp.currentLat,
          currentLng: dp.currentLng,
          distanceToPickupKm: distanceToPickup,
          etaMins: Math.max(3, Math.round(distanceToPickup * 2.5))
        };
      }).sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
    } catch (err) {
      console.warn('[DispatchService] Fallback to memory for eligible drivers:', err.message);
    }
  }

  // Memory fallback
  const drivers = memoryStore.driverProfiles.filter(dp => {
    if (!dp.isShiftActive || !dp.isAvailable || dp.kycStatus !== 'APPROVED') return false;
    const vehicle = memoryStore.vehicles.find(v => v.id === dp.assignedVehicleId);
    return vehicle && vehicle.category === category && vehicle.status === 'ACTIVE';
  });

  return drivers.map(dp => {
    const user = memoryStore.users.find(u => u.id === dp.userId);
    const vehicle = memoryStore.vehicles.find(v => v.id === dp.assignedVehicleId);
    const distanceToPickup = (dp.currentLat && dp.currentLng)
      ? haversineDistance(dp.currentLat, dp.currentLng, pickupLat, pickupLng)
      : 2.0;

    return {
      driverId: dp.userId,
      driverName: user ? user.name : 'Driver',
      phone: user ? user.phone : '',
      profilePic: user ? user.profilePic : null,
      rating: dp.rating,
      totalTrips: dp.totalTrips,
      vehicleId: vehicle ? vehicle.id : null,
      vehicleReg: vehicle ? vehicle.regNumber : 'N/A',
      vehicleModel: vehicle ? `${vehicle.make} ${vehicle.model}` : 'N/A',
      vehicleCategory: vehicle ? vehicle.category : category,
      currentLat: dp.currentLat,
      currentLng: dp.currentLng,
      distanceToPickupKm: distanceToPickup,
      etaMins: Math.max(3, Math.round(distanceToPickup * 2.5))
    };
  }).sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
}

/**
 * Concurrency-safe driver & vehicle assignment
 */
async function assignDriverAndVehicle({ bookingId, driverId, vehicleId, actorId, actorRole, io = null }) {
  if (isDbConnected() && prisma) {
    try {
      // Execute in atomic transaction to prevent concurrent duplicate assignments
      return await prisma.$transaction(async (tx) => {
        // 1. Verify booking is in PENDING status
        const booking = await tx.booking.findUnique({ where: { id: bookingId } });
        if (!booking) {
          throw new Error('Booking not found');
        }
        if (booking.status !== BOOKING_STATUS.PENDING) {
          throw new Error(`Booking is already ${booking.status}`);
        }

        // 2. Verify driver has no other active trip
        const activeDriverTrip = await tx.booking.findFirst({
          where: {
            driverId,
            status: { in: [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED] }
          }
        });
        if (activeDriverTrip) {
          throw new Error('Driver is already assigned to another active trip');
        }

        // 3. Update booking
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            driverId,
            vehicleId,
            status: BOOKING_STATUS.ASSIGNED
          },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            driver: { select: { id: true, name: true, phone: true } },
            vehicle: true
          }
        });

        // 4. Update driver profile availability
        await tx.driverProfile.update({
          where: { userId: driverId },
          data: { isAvailable: false }
        });

        // 5. Create notification for customer
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            title: 'Driver Assigned!',
            message: `Your driver has been assigned. OTP: ${booking.otpCode}`,
            type: 'BOOKING_UPDATE',
            link: `/tracking/${booking.id}`
          }
        });

        return updatedBooking;
      });
    } catch (err) {
      if (err.message.includes('already') || err.message.includes('Booking not found')) {
        throw err;
      }
      console.warn('[DispatchService] Fallback to memory for assignment:', err.message);
    }
  }

  // Memory transaction emulation
  const booking = memoryStore.bookings.find(b => b.id === bookingId || b.bookingRef === bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new Error(`Booking is already ${booking.status}`);
  }

  // Concurrency check in memory
  const hasActiveTrip = memoryStore.bookings.some(
    b => b.driverId === driverId && [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED].includes(b.status)
  );
  if (hasActiveTrip) {
    throw new Error('Driver is already assigned to another active trip');
  }

  const driverUser = memoryStore.users.find(u => u.id === driverId);
  const driverProfile = memoryStore.driverProfiles.find(dp => dp.userId === driverId);
  const resolvedVehicleId = vehicleId || (driverProfile ? driverProfile.assignedVehicleId : null);
  const vehicle = memoryStore.vehicles.find(v => v.id === resolvedVehicleId);

  booking.driverId = driverId;
  booking.vehicleId = resolvedVehicleId;
  booking.status = BOOKING_STATUS.ASSIGNED;
  booking.updatedAt = new Date();

  if (driverProfile) {
    driverProfile.isAvailable = false;
  }

  // Log audit
  await logAction({
    actorId,
    actorRole,
    action: 'DRIVER_ASSIGNED',
    entityType: 'Booking',
    entityId: booking.id,
    details: { bookingRef: booking.bookingRef, driverId, vehicleId: resolvedVehicleId }
  });

  const enrichedBooking = {
    ...booking,
    customer: memoryStore.users.find(u => u.id === booking.customerId),
    driver: driverUser,
    vehicle: vehicle
  };

  // Broadcast if Socket.IO is provided
  if (io) {
    io.to(`booking_${booking.id}`).emit('booking:status_update', enrichedBooking);
    io.to(`driver_${driverId}`).emit('trip:new_assignment', enrichedBooking);
    io.to('admin_dispatch').emit('dispatch:booking_updated', enrichedBooking);
  }

  return enrichedBooking;
}

/**
 * Auto-dispatches the closest eligible driver for a pending booking
 */
async function autoDispatch({ bookingId, actorId = 'system', actorRole = 'SYSTEM', io = null }) {
  let booking;
  if (isDbConnected() && prisma) {
    try {
      booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    } catch (err) {
      booking = memoryStore.bookings.find(b => b.id === bookingId);
    }
  } else {
    booking = memoryStore.bookings.find(b => b.id === bookingId);
  }

  if (!booking) throw new Error('Booking not found');
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new Error(`Booking is already ${booking.status}`);
  }

  const candidates = await findEligibleDrivers({
    category: booking.category,
    pickupLat: booking.pickupLat,
    pickupLng: booking.pickupLng
  });

  if (!candidates || candidates.length === 0) {
    throw new Error(`No available ${booking.category} drivers online within Dindigul at this moment.`);
  }

  const bestDriver = candidates[0];
  return await assignDriverAndVehicle({
    bookingId: booking.id,
    driverId: bestDriver.driverId,
    vehicleId: bestDriver.vehicleId,
    actorId,
    actorRole,
    io
  });
}

/**
 * Cancels a booking and frees the assigned driver/vehicle
 */
async function cancelBooking({ bookingId, reason, cancelledBy = 'CUSTOMER', actorId = null, io = null }) {
  let booking;
  if (isDbConnected() && prisma) {
    try {
      booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error('Booking not found');
      if (booking.status === BOOKING_STATUS.COMPLETED) {
        throw new Error('Cannot cancel an already completed trip');
      }

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BOOKING_STATUS.CANCELLED,
          cancellationReason: reason,
          cancelledBy
        }
      });

      if (booking.driverId) {
        await prisma.driverProfile.updateMany({
          where: { userId: booking.driverId },
          data: { isAvailable: true }
        });
      }

      await logAction({
        actorId,
        actorRole: cancelledBy,
        action: 'BOOKING_CANCELLED',
        entityType: 'Booking',
        entityId: bookingId,
        details: { reason, cancelledBy }
      });

      if (io) {
        io.to(`booking_${bookingId}`).emit('booking:cancelled', { bookingId, reason, cancelledBy });
        if (booking.driverId) {
          io.to(`driver_${booking.driverId}`).emit('trip:cancelled', { bookingId, reason });
        }
        io.to('admin_dispatch').emit('dispatch:booking_cancelled', { bookingId, reason });
      }

      return updated;
    } catch (err) {
      if (err.message.includes('Cannot cancel') || err.message.includes('not found')) throw err;
      console.warn('[DispatchService] Fallback to memory for cancel:', err.message);
    }
  }

  // Memory fallback
  booking = memoryStore.bookings.find(b => b.id === bookingId || b.bookingRef === bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.status === BOOKING_STATUS.COMPLETED) {
    throw new Error('Cannot cancel an already completed trip');
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancellationReason = reason;
  booking.cancelledBy = cancelledBy;
  booking.updatedAt = new Date();

  if (booking.driverId) {
    const dp = memoryStore.driverProfiles.find(d => d.userId === booking.driverId);
    if (dp) dp.isAvailable = true;
  }

  await logAction({
    actorId,
    actorRole: cancelledBy,
    action: 'BOOKING_CANCELLED',
    entityType: 'Booking',
    entityId: booking.id,
    details: { reason, cancelledBy }
  });

  if (io) {
    io.to(`booking_${booking.id}`).emit('booking:cancelled', { bookingId: booking.id, reason, cancelledBy });
    if (booking.driverId) {
      io.to(`driver_${booking.driverId}`).emit('trip:cancelled', { bookingId: booking.id, reason });
    }
    io.to('admin_dispatch').emit('dispatch:booking_cancelled', { bookingId: booking.id, reason });
  }

  return booking;
}

module.exports = {
  findEligibleDrivers,
  assignDriverAndVehicle,
  autoDispatch,
  cancelBooking
};
