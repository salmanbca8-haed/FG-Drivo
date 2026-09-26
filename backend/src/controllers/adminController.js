const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { BOOKING_STATUS } = require('../config/constants');
const { assignDriverAndVehicle } = require('../services/dispatchService');
const { getAuditLogs, logAction } = require('../services/auditService');

/**
 * Dashboard Overview Metrics
 */
async function getDashboardMetrics(req, res, next) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let activeRides = 0;
    let pendingDispatch = 0;
    let availableDrivers = 0;
    let totalFleet = 0;
    let completedToday = 0;
    let todayRevenue = 0;

    if (isDbConnected() && prisma) {
      try {
        activeRides = await prisma.booking.count({
          where: { status: { in: [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED] } }
        });
        pendingDispatch = await prisma.booking.count({
          where: { status: BOOKING_STATUS.PENDING }
        });
        availableDrivers = await prisma.driverProfile.count({
          where: { isShiftActive: true, isAvailable: true, kycStatus: 'APPROVED' }
        });
        totalFleet = await prisma.vehicle.count({
          where: { status: 'ACTIVE' }
        });

        const todayCompleted = await prisma.booking.findMany({
          where: {
            status: BOOKING_STATUS.COMPLETED,
            createdAt: { gte: todayStart }
          },
          select: { finalFare: true, estimatedFare: true }
        });
        completedToday = todayCompleted.length;
        todayRevenue = todayCompleted.reduce((acc, b) => acc + (b.finalFare || b.estimatedFare || 0), 0);

        return res.json({
          success: true,
          metrics: {
            activeRides,
            pendingDispatch,
            availableDrivers,
            totalFleet,
            completedToday,
            todayRevenue: Math.round(todayRevenue)
          }
        });
      } catch (err) {
        console.warn('[AdminController] Fallback to memory for metrics:', err.message);
      }
    }

    // Memory Store metrics
    activeRides = memoryStore.bookings.filter(b => [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED].includes(b.status)).length;
    pendingDispatch = memoryStore.bookings.filter(b => b.status === BOOKING_STATUS.PENDING).length;
    availableDrivers = memoryStore.driverProfiles.filter(dp => dp.isShiftActive && dp.isAvailable && dp.kycStatus === 'APPROVED').length;
    totalFleet = memoryStore.vehicles.filter(v => v.status === 'ACTIVE').length;
    const completed = memoryStore.bookings.filter(b => b.status === BOOKING_STATUS.COMPLETED);
    completedToday = completed.length;
    todayRevenue = completed.reduce((acc, b) => acc + (b.finalFare || b.estimatedFare || 0), 0);

    return res.json({
      success: true,
      metrics: {
        activeRides,
        pendingDispatch,
        availableDrivers,
        totalFleet,
        completedToday,
        todayRevenue: Math.round(todayRevenue)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Dispatch console bookings list
 */
async function getDispatchBookings(req, res, next) {
  try {
    const { status } = req.query;

    if (isDbConnected() && prisma) {
      try {
        const where = status ? { status } : {};
        const bookings = await prisma.booking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            driver: {
              select: {
                id: true,
                name: true,
                phone: true,
                driverProfile: { select: { rating: true, currentLat: true, currentLng: true } }
              }
            },
            vehicle: true,
            payments: true
          }
        });
        return res.json({ success: true, bookings });
      } catch (err) {
        console.warn('[AdminController] Fallback to memory for dispatch bookings:', err.message);
      }
    }

    let bookings = memoryStore.bookings;
    if (status) bookings = bookings.filter(b => b.status === status);

    const enriched = bookings.map(b => {
      const dUser = b.driverId ? memoryStore.users.find(u => u.id === b.driverId) : null;
      const dProf = b.driverId ? memoryStore.driverProfiles.find(dp => dp.userId === b.driverId) : null;
      return {
        ...b,
        customer: memoryStore.users.find(u => u.id === b.customerId),
        driver: dUser ? {
          id: dUser.id,
          name: dUser.name,
          phone: dUser.phone,
          driverProfile: dProf
        } : null,
        vehicle: b.vehicleId ? memoryStore.vehicles.find(v => v.id === b.vehicleId) : null,
        payments: memoryStore.payments.filter(p => p.bookingId === b.id)
      };
    });

    return res.json({ success: true, bookings: enriched });
  } catch (error) {
    next(error);
  }
}

/**
 * Manual dispatch assignment
 */
async function assignDriver(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { driverId, vehicleId } = req.body;
    const io = req.app.get('io');

    const result = await assignDriverAndVehicle({
      bookingId,
      driverId,
      vehicleId,
      actorId: req.user.id,
      actorRole: req.user.role,
      io
    });

    return res.json({
      success: true,
      message: 'Driver successfully dispatched to ride.',
      booking: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Fleet list
 */
async function getFleet(req, res, next) {
  try {
    if (isDbConnected() && prisma) {
      try {
        const vehicles = await prisma.vehicle.findMany({
          orderBy: { category: 'asc' },
          include: {
            driverProfiles: {
              include: { user: { select: { id: true, name: true, phone: true } } }
            }
          }
        });
        return res.json({ success: true, vehicles });
      } catch (err) {
        console.warn('[AdminController] Fallback to memory for fleet:', err.message);
      }
    }

    const vehicles = memoryStore.vehicles.map(v => {
      const assignedProfile = memoryStore.driverProfiles.find(dp => dp.assignedVehicleId === v.id);
      const user = assignedProfile ? memoryStore.users.find(u => u.id === assignedProfile.userId) : null;
      return {
        ...v,
        driverProfiles: assignedProfile ? [{ ...assignedProfile, user }] : []
      };
    });

    return res.json({ success: true, vehicles });
  } catch (error) {
    next(error);
  }
}

/**
 * Create or update vehicle
 */
async function saveVehicle(req, res, next) {
  try {
    const { id, regNumber, make, model, year, color, category, capacity, fuelType, status } = req.body;

    if (isDbConnected() && prisma) {
      try {
        let vehicle;
        if (id) {
          vehicle = await prisma.vehicle.update({
            where: { id },
            data: { regNumber, make, model, year: Number(year), color, category, capacity: Number(capacity), fuelType, status }
          });
        } else {
          vehicle = await prisma.vehicle.create({
            data: { regNumber, make, model, year: Number(year), color, category, capacity: Number(capacity), fuelType, status: status || 'ACTIVE' }
          });
        }
        await logAction({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: id ? 'VEHICLE_UPDATED' : 'VEHICLE_CREATED',
          entityType: 'Vehicle',
          entityId: vehicle.id,
          details: { regNumber, category }
        });
        return res.json({ success: true, vehicle });
      } catch (err) {
        console.warn('[AdminController] Fallback to memory for vehicle save:', err.message);
      }
    }

    let vehicle;
    if (id) {
      const idx = memoryStore.vehicles.findIndex(v => v.id === id);
      if (idx !== -1) {
        memoryStore.vehicles[idx] = {
          ...memoryStore.vehicles[idx],
          regNumber,
          make,
          model,
          year: Number(year),
          color,
          category,
          capacity: Number(capacity),
          fuelType,
          status: status || 'ACTIVE',
          updatedAt: new Date()
        };
        vehicle = memoryStore.vehicles[idx];
      }
    } else {
      vehicle = {
        id: `veh-${Date.now()}`,
        regNumber,
        make,
        model,
        year: Number(year),
        color,
        category,
        capacity: Number(capacity),
        fuelType: fuelType || 'PETROL',
        status: status || 'ACTIVE',
        insuranceExpiry: new Date('2027-01-01'),
        fitnessExpiry: new Date('2027-01-01'),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryStore.vehicles.push(vehicle);
    }

    await logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: id ? 'VEHICLE_UPDATED' : 'VEHICLE_CREATED',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      details: { regNumber, category }
    });

    return res.json({ success: true, vehicle });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all Drivers with KYC details
 */
async function getDrivers(req, res, next) {
  try {
    if (isDbConnected() && prisma) {
      try {
        const drivers = await prisma.driverProfile.findMany({
          include: {
            user: { select: { id: true, name: true, phone: true, email: true, status: true } },
            assignedVehicle: true
          }
        });
        return res.json({ success: true, drivers });
      } catch (err) {
        console.warn('[AdminController] Fallback to memory for drivers:', err.message);
      }
    }

    const drivers = memoryStore.driverProfiles.map(dp => ({
      ...dp,
      user: memoryStore.users.find(u => u.id === dp.userId),
      assignedVehicle: memoryStore.vehicles.find(v => v.id === dp.assignedVehicleId)
    }));

    return res.json({ success: true, drivers });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve or Reject Driver KYC
 */
async function updateDriverKyc(req, res, next) {
  try {
    const { driverId } = req.params;
    const { kycStatus, assignedVehicleId } = req.body;

    if (isDbConnected() && prisma) {
      try {
        const updated = await prisma.driverProfile.update({
          where: { userId: driverId },
          data: {
            kycStatus,
            ...(assignedVehicleId ? { assignedVehicleId } : {})
          }
        });
        await logAction({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: `DRIVER_KYC_${kycStatus}`,
          entityType: 'DriverProfile',
          entityId: driverId,
          details: { kycStatus, assignedVehicleId }
        });
        return res.json({ success: true, profile: updated });
      } catch (err) {
        console.warn('[AdminController] Fallback to memory for KYC update:', err.message);
      }
    }

    const dp = memoryStore.driverProfiles.find(d => d.userId === driverId);
    if (dp) {
      dp.kycStatus = kycStatus;
      if (assignedVehicleId) dp.assignedVehicleId = assignedVehicleId;
      dp.updatedAt = new Date();
    }

    await logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `DRIVER_KYC_${kycStatus}`,
      entityType: 'DriverProfile',
      entityId: driverId,
      details: { kycStatus, assignedVehicleId }
    });

    return res.json({ success: true, profile: dp });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Fare Rules
 */
async function getFareRules(req, res, next) {
  try {
    if (isDbConnected() && prisma) {
      try {
        const rules = await prisma.fareRule.findMany();
        return res.json({ success: true, rules });
      } catch (err) {
        // memory fallback
      }
    }
    return res.json({ success: true, rules: memoryStore.fareRules });
  } catch (error) {
    next(error);
  }
}

/**
 * Update Fare Rule
 */
async function updateFareRule(req, res, next) {
  try {
    const { category } = req.params;
    const { baseFare, baseDistanceKm, perKmRate, minimumFare, waitingChargePerMin, nightSurchargeMultiplier, peakHourMultiplier } = req.body;

    if (isDbConnected() && prisma) {
      try {
        const updated = await prisma.fareRule.upsert({
          where: { category },
          update: {
            baseFare: Number(baseFare),
            baseDistanceKm: Number(baseDistanceKm),
            perKmRate: Number(perKmRate),
            minimumFare: Number(minimumFare),
            waitingChargePerMin: Number(waitingChargePerMin),
            nightSurchargeMultiplier: Number(nightSurchargeMultiplier),
            peakHourMultiplier: Number(peakHourMultiplier)
          },
          create: {
            category,
            baseFare: Number(baseFare),
            baseDistanceKm: Number(baseDistanceKm),
            perKmRate: Number(perKmRate),
            minimumFare: Number(minimumFare),
            waitingChargePerMin: Number(waitingChargePerMin),
            nightSurchargeMultiplier: Number(nightSurchargeMultiplier),
            peakHourMultiplier: Number(peakHourMultiplier)
          }
        });
        await logAction({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: 'FARE_RULE_UPDATED',
          entityType: 'FareRule',
          entityId: category,
          details: req.body
        });
        return res.json({ success: true, rule: updated });
      } catch (err) {
        // fallback
      }
    }

    const idx = memoryStore.fareRules.findIndex(r => r.category === category);
    if (idx !== -1) {
      memoryStore.fareRules[idx] = {
        ...memoryStore.fareRules[idx],
        baseFare: Number(baseFare),
        baseDistanceKm: Number(baseDistanceKm),
        perKmRate: Number(perKmRate),
        minimumFare: Number(minimumFare),
        waitingChargePerMin: Number(waitingChargePerMin),
        nightSurchargeMultiplier: Number(nightSurchargeMultiplier),
        peakHourMultiplier: Number(peakHourMultiplier),
        updatedAt: new Date()
      };
    }

    await logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FARE_RULE_UPDATED',
      entityType: 'FareRule',
      entityId: category,
      details: req.body
    });

    return res.json({ success: true, rule: memoryStore.fareRules[idx] });
  } catch (error) {
    next(error);
  }
}

/**
 * Get payments ledger
 */
async function getPaymentsLedger(req, res, next) {
  try {
    if (isDbConnected() && prisma) {
      try {
        const payments = await prisma.payment.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            booking: {
              include: {
                customer: { select: { id: true, name: true, phone: true } },
                driver: { select: { id: true, name: true, phone: true } }
              }
            }
          }
        });
        return res.json({ success: true, payments });
      } catch (err) {
        // fallback
      }
    }

    const payments = memoryStore.payments.map(p => {
      const b = memoryStore.bookings.find(bk => bk.id === p.bookingId);
      return {
        ...p,
        booking: b ? {
          ...b,
          customer: memoryStore.users.find(u => u.id === b.customerId),
          driver: memoryStore.users.find(u => u.id === b.driverId)
        } : null
      };
    });

    return res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
}

/**
 * Get audit logs
 */
async function getAuditLogsEndpoint(req, res, next) {
  try {
    const logs = await getAuditLogs({ limit: 100 });
    return res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardMetrics,
  getDispatchBookings,
  assignDriver,
  getFleet,
  saveVehicle,
  getDrivers,
  updateDriverKyc,
  getFareRules,
  updateFareRule,
  getPaymentsLedger,
  getAuditLogsEndpoint
};
