const bcrypt = require('bcryptjs');
const { DEFAULT_FARE_RULES, VEHICLE_CATEGORIES, ROLES, BOOKING_STATUS } = require('../config/constants');
const { DINDIGUL_CENTER, DINDIGUL_LANDMARKS } = require('../config/dindigulGeo');

// Salt & Hash demo password
const defaultPasswordHash = bcrypt.hashSync('drivo123', 10);
const adminPasswordHash = bcrypt.hashSync('admin123', 10);

class MemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = [
      {
        id: 'usr-admin-1',
        name: 'Murugan Admin',
        email: 'admin@fgdrivo.com',
        phone: '9842100001',
        passwordHash: adminPasswordHash,
        role: ROLES.ADMIN,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'usr-disp-1',
        name: 'Kavitha Dispatcher',
        email: 'dispatch@fgdrivo.com',
        phone: '9842100002',
        passwordHash: adminPasswordHash,
        role: ROLES.DISPATCHER,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'usr-driver-1',
        name: 'Senthil Kumar (Auto)',
        email: 'senthil@fgdrivo.com',
        phone: '9842111001',
        passwordHash: defaultPasswordHash,
        role: ROLES.DRIVER,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'usr-driver-2',
        name: 'Anand Raj (Sedan)',
        email: 'anand@fgdrivo.com',
        phone: '9842111002',
        passwordHash: defaultPasswordHash,
        role: ROLES.DRIVER,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'usr-driver-3',
        name: 'Praveen Velu (SUV)',
        email: 'praveen@fgdrivo.com',
        phone: '9842111003',
        passwordHash: defaultPasswordHash,
        role: ROLES.DRIVER,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'usr-driver-4',
        name: 'Muthu Krishnan (Mini)',
        email: 'muthu@fgdrivo.com',
        phone: '9842111004',
        passwordHash: defaultPasswordHash,
        role: ROLES.DRIVER,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'usr-cust-1',
        name: 'Priya Ramesh',
        email: 'priya@gmail.com',
        phone: '9842122001',
        passwordHash: defaultPasswordHash,
        role: ROLES.CUSTOMER,
        status: 'ACTIVE',
        profilePic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      }
    ];

    this.vehicles = [
      {
        id: 'veh-1',
        regNumber: 'TN 57 AW 1088',
        make: 'Bajaj',
        model: 'Compact RE Auto',
        year: 2024,
        color: 'Yellow & Violet',
        category: VEHICLE_CATEGORIES.AUTO,
        capacity: 3,
        fuelType: 'CNG',
        status: 'ACTIVE',
        insuranceExpiry: new Date('2027-01-01'),
        fitnessExpiry: new Date('2027-01-01'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'veh-2',
        regNumber: 'TN 57 B 4420',
        make: 'Maruti Suzuki',
        model: 'Dzire Prime',
        year: 2025,
        color: 'Royal Violet & White',
        category: VEHICLE_CATEGORIES.SEDAN,
        capacity: 4,
        fuelType: 'PETROL',
        status: 'ACTIVE',
        insuranceExpiry: new Date('2027-03-15'),
        fitnessExpiry: new Date('2027-03-15'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'veh-3',
        regNumber: 'TN 57 C 8899',
        make: 'Toyota',
        model: 'Innova Crysta',
        year: 2024,
        color: 'Pearl White & Gold',
        category: VEHICLE_CATEGORIES.SUV,
        capacity: 7,
        fuelType: 'DIESEL',
        status: 'ACTIVE',
        insuranceExpiry: new Date('2027-05-10'),
        fitnessExpiry: new Date('2027-05-10'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'veh-4',
        regNumber: 'TN 57 D 3112',
        make: 'Tata',
        model: 'Tiago EV Express',
        year: 2025,
        color: 'Yellow Taxi Edition',
        category: VEHICLE_CATEGORIES.MINI,
        capacity: 4,
        fuelType: 'ELECTRIC',
        status: 'ACTIVE',
        insuranceExpiry: new Date('2027-04-20'),
        fitnessExpiry: new Date('2027-04-20'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      }
    ];

    this.driverProfiles = [
      {
        id: 'dp-1',
        userId: 'usr-driver-1',
        licenseNumber: 'TN57-2018-004491',
        licenseExpiry: new Date('2030-05-12'),
        kycStatus: 'APPROVED',
        isAvailable: true,
        isShiftActive: true,
        currentLat: 10.3630,
        currentLng: 77.9710,
        lastLocationUpdate: new Date(),
        rating: 4.9,
        totalTrips: 184,
        assignedVehicleId: 'veh-1',
        documentsJson: JSON.stringify({ aadhaar: 'verified', license: 'verified', policeVerification: 'passed' }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'dp-2',
        userId: 'usr-driver-2',
        licenseNumber: 'TN57-2016-009122',
        licenseExpiry: new Date('2031-08-20'),
        kycStatus: 'APPROVED',
        isAvailable: true,
        isShiftActive: true,
        currentLat: 10.3680,
        currentLng: 77.9740,
        lastLocationUpdate: new Date(),
        rating: 4.95,
        totalTrips: 340,
        assignedVehicleId: 'veh-2',
        documentsJson: JSON.stringify({ aadhaar: 'verified', license: 'verified', policeVerification: 'passed' }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'dp-3',
        userId: 'usr-driver-3',
        licenseNumber: 'TN57-2015-001289',
        licenseExpiry: new Date('2029-11-15'),
        kycStatus: 'APPROVED',
        isAvailable: true,
        isShiftActive: true,
        currentLat: 10.3740,
        currentLng: 77.9640,
        lastLocationUpdate: new Date(),
        rating: 4.88,
        totalTrips: 215,
        assignedVehicleId: 'veh-3',
        documentsJson: JSON.stringify({ aadhaar: 'verified', license: 'verified', policeVerification: 'passed' }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'dp-4',
        userId: 'usr-driver-4',
        licenseNumber: 'TN57-2020-008741',
        licenseExpiry: new Date('2032-02-18'),
        kycStatus: 'APPROVED',
        isAvailable: true,
        isShiftActive: true,
        currentLat: 10.3590,
        currentLng: 77.9670,
        lastLocationUpdate: new Date(),
        rating: 4.85,
        totalTrips: 128,
        assignedVehicleId: 'veh-4',
        documentsJson: JSON.stringify({ aadhaar: 'verified', license: 'verified', policeVerification: 'passed' }),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      }
    ];

    this.fareRules = DEFAULT_FARE_RULES.map((rule, idx) => ({
      id: `fare-${idx + 1}`,
      ...rule,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z')
    }));

    this.serviceBoundaries = [
      {
        id: 'sb-1',
        name: 'Dindigul Municipal Corporation & Suburbs',
        centerLat: DINDIGUL_CENTER.lat,
        centerLng: DINDIGUL_CENTER.lng,
        radiusKm: DINDIGUL_CENTER.radiusKm,
        polygonCoordinates: null,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      }
    ];

    this.bookings = [
      {
        id: 'bk-1001',
        bookingRef: 'FGD-20260926-1001',
        customerId: 'usr-cust-1',
        driverId: 'usr-driver-2',
        vehicleId: 'veh-2',
        status: BOOKING_STATUS.TRIP_STARTED,
        pickupAddress: 'Dindigul Railway Junction, Nagal Nagar',
        pickupLat: 10.3695,
        pickupLng: 77.9730,
        dropAddress: 'GTN Arts & Science College, Karur Road',
        dropLat: 10.3950,
        dropLng: 77.9890,
        distanceKm: 4.2,
        durationMins: 12,
        category: VEHICLE_CATEGORIES.SEDAN,
        isScheduled: false,
        scheduledFor: null,
        baseFare: 120.0,
        perKmRate: 24.0,
        estimatedFare: 172.8,
        finalFare: 172.8,
        otpCode: '4821',
        cancellationReason: null,
        cancelledBy: null,
        fareRuleSnapshot: JSON.stringify({ baseFare: 120, perKmRate: 24, baseDistanceKm: 2 }),
        createdAt: new Date(Date.now() - 15 * 60000),
        updatedAt: new Date()
      }
    ];

    this.payments = [
      {
        id: 'pay-1001',
        bookingId: 'bk-1001',
        amount: 172.8,
        method: 'UPI',
        status: 'PENDING',
        transactionRef: 'UPI-FGD-20260926-9882',
        gatewayPaymentId: null,
        gatewaySignature: null,
        collectedBy: 'DRIVER',
        notes: 'Customer opted for UPI on arrival',
        createdAt: new Date(Date.now() - 15 * 60000),
        updatedAt: new Date()
      }
    ];

    this.locationLogs = [
      {
        id: 'loc-1',
        bookingId: 'bk-1001',
        driverId: 'usr-driver-2',
        lat: 10.3725,
        lng: 77.9760,
        speed: 38.5,
        heading: 45.0,
        recordedAt: new Date()
      }
    ];

    this.supportTickets = [
      {
        id: 'tkt-1',
        ticketRef: 'TKT-2026-001',
        customerId: 'usr-cust-1',
        bookingId: 'bk-1001',
        subject: 'Scheduled ride query',
        message: 'Can I book an SUV for tomorrow morning 6 AM trip to Palani?',
        priority: 'MEDIUM',
        status: 'OPEN',
        resolutionNotes: null,
        assignedStaffId: 'usr-admin-1',
        createdAt: new Date('2026-09-26T08:00:00Z'),
        updatedAt: new Date('2026-09-26T08:00:00Z')
      }
    ];

    this.auditLogs = [
      {
        id: 'aud-1',
        actorId: 'usr-admin-1',
        actorRole: 'ADMIN',
        action: 'SYSTEM_BOOT',
        entityType: 'System',
        entityId: 'root',
        details: JSON.stringify({ message: 'FG DRIVO Dindigul Fleet initialized successfully' }),
        ipAddress: '127.0.0.1',
        createdAt: new Date()
      }
    ];

    this.notifications = [
      {
        id: 'notif-1',
        userId: 'usr-cust-1',
        title: 'Trip Started',
        message: 'Driver Anand Raj has started your trip to GTN Arts College.',
        type: 'BOOKING_UPDATE',
        isRead: false,
        link: '/tracking/bk-1001',
        createdAt: new Date(Date.now() - 5 * 60000)
      }
    ];
  }
}

const memoryStore = new MemoryStore();
module.exports = memoryStore;
