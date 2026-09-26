module.exports = {
  ROLES: {
    CUSTOMER: 'CUSTOMER',
    DRIVER: 'DRIVER',
    ADMIN: 'ADMIN',
    DISPATCHER: 'DISPATCHER'
  },
  BOOKING_STATUS: {
    PENDING: 'PENDING',
    ASSIGNED: 'ASSIGNED',
    DRIVER_ARRIVED: 'DRIVER_ARRIVED',
    TRIP_STARTED: 'TRIP_STARTED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  },
  VEHICLE_CATEGORIES: {
    AUTO: 'AUTO',
    MINI: 'MINI',
    SEDAN: 'SEDAN',
    SUV: 'SUV'
  },
  PAYMENT_METHODS: {
    CASH: 'CASH',
    UPI: 'UPI',
    ONLINE: 'ONLINE'
  },
  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
  },
  DEFAULT_FARE_RULES: [
    {
      category: 'AUTO',
      baseFare: 40.0,
      baseDistanceKm: 1.5,
      perKmRate: 16.0,
      minimumFare: 40.0,
      waitingChargePerMin: 1.5,
      nightSurchargeMultiplier: 1.25,
      peakHourMultiplier: 1.15,
      isActive: true
    },
    {
      category: 'MINI',
      baseFare: 80.0,
      baseDistanceKm: 2.0,
      perKmRate: 20.0,
      minimumFare: 80.0,
      waitingChargePerMin: 2.0,
      nightSurchargeMultiplier: 1.25,
      peakHourMultiplier: 1.15,
      isActive: true
    },
    {
      category: 'SEDAN',
      baseFare: 120.0,
      baseDistanceKm: 2.0,
      perKmRate: 24.0,
      minimumFare: 120.0,
      waitingChargePerMin: 2.5,
      nightSurchargeMultiplier: 1.25,
      peakHourMultiplier: 1.15,
      isActive: true
    },
    {
      category: 'SUV',
      baseFare: 180.0,
      baseDistanceKm: 2.0,
      perKmRate: 30.0,
      minimumFare: 180.0,
      waitingChargePerMin: 3.0,
      nightSurchargeMultiplier: 1.25,
      peakHourMultiplier: 1.15,
      isActive: true
    }
  ]
};
