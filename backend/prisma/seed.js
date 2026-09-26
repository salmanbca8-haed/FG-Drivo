const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { DEFAULT_FARE_RULES, VEHICLE_CATEGORIES, ROLES } = require('../src/config/constants');
const { DINDIGUL_CENTER } = require('../src/config/dindigulGeo');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting FG DRIVO database seed for Dindigul...');

  const defaultPasswordHash = await bcrypt.hash('drivo123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 1. Seed Service Boundary
  console.log('[Seed] Upserting Service Boundary...');
  await prisma.serviceBoundary.upsert({
    where: { id: 'sb-1' },
    update: {},
    create: {
      id: 'sb-1',
      name: 'Dindigul Municipal Corporation & Suburbs',
      centerLat: DINDIGUL_CENTER.lat,
      centerLng: DINDIGUL_CENTER.lng,
      radiusKm: DINDIGUL_CENTER.radiusKm,
      isActive: true
    }
  });

  // 2. Seed Fare Rules
  console.log('[Seed] Upserting Fare Rules...');
  for (const rule of DEFAULT_FARE_RULES) {
    await prisma.fareRule.upsert({
      where: { category: rule.category },
      update: rule,
      create: rule
    });
  }

  // 3. Seed Users
  console.log('[Seed] Upserting Users...');
  const adminUser = await prisma.user.upsert({
    where: { phone: '9842100001' },
    update: {},
    create: {
      id: 'usr-admin-1',
      name: 'Murugan Admin',
      email: 'admin@fgdrivo.com',
      phone: '9842100001',
      passwordHash: adminPasswordHash,
      role: ROLES.ADMIN,
      status: 'ACTIVE'
    }
  });

  const dispatchUser = await prisma.user.upsert({
    where: { phone: '9842100002' },
    update: {},
    create: {
      id: 'usr-disp-1',
      name: 'Kavitha Dispatcher',
      email: 'dispatch@fgdrivo.com',
      phone: '9842100002',
      passwordHash: adminPasswordHash,
      role: ROLES.DISPATCHER,
      status: 'ACTIVE'
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { phone: '9842122001' },
    update: {},
    create: {
      id: 'usr-cust-1',
      name: 'Priya Ramesh',
      email: 'priya@gmail.com',
      phone: '9842122001',
      passwordHash: defaultPasswordHash,
      role: ROLES.CUSTOMER,
      status: 'ACTIVE'
    }
  });

  // 4. Seed Vehicles
  console.log('[Seed] Upserting Vehicles...');
  const v1 = await prisma.vehicle.upsert({
    where: { regNumber: 'TN 57 AW 1088' },
    update: {},
    create: {
      id: 'veh-1',
      regNumber: 'TN 57 AW 1088',
      make: 'Bajaj',
      model: 'Compact RE Auto',
      year: 2024,
      color: 'Yellow & Violet',
      category: VEHICLE_CATEGORIES.AUTO,
      capacity: 3,
      fuelType: 'CNG',
      status: 'ACTIVE'
    }
  });

  const v2 = await prisma.vehicle.upsert({
    where: { regNumber: 'TN 57 B 4420' },
    update: {},
    create: {
      id: 'veh-2',
      regNumber: 'TN 57 B 4420',
      make: 'Maruti Suzuki',
      model: 'Dzire Prime',
      year: 2025,
      color: 'Royal Violet & White',
      category: VEHICLE_CATEGORIES.SEDAN,
      capacity: 4,
      fuelType: 'PETROL',
      status: 'ACTIVE'
    }
  });

  const v3 = await prisma.vehicle.upsert({
    where: { regNumber: 'TN 57 C 8899' },
    update: {},
    create: {
      id: 'veh-3',
      regNumber: 'TN 57 C 8899',
      make: 'Toyota',
      model: 'Innova Crysta',
      year: 2024,
      color: 'Pearl White & Gold',
      category: VEHICLE_CATEGORIES.SUV,
      capacity: 7,
      fuelType: 'DIESEL',
      status: 'ACTIVE'
    }
  });

  const v4 = await prisma.vehicle.upsert({
    where: { regNumber: 'TN 57 D 3112' },
    update: {},
    create: {
      id: 'veh-4',
      regNumber: 'TN 57 D 3112',
      make: 'Tata',
      model: 'Tiago EV Express',
      year: 2025,
      color: 'Yellow Taxi Edition',
      category: VEHICLE_CATEGORIES.MINI,
      capacity: 4,
      fuelType: 'ELECTRIC',
      status: 'ACTIVE'
    }
  });

  // 5. Seed Drivers & Profiles
  console.log('[Seed] Upserting Drivers & Profiles...');
  const driversData = [
    {
      id: 'usr-driver-1',
      name: 'Senthil Kumar (Auto)',
      email: 'senthil@fgdrivo.com',
      phone: '9842111001',
      license: 'TN57-2018-004491',
      vehicleId: 'veh-1',
      lat: 10.3630,
      lng: 77.9710
    },
    {
      id: 'usr-driver-2',
      name: 'Anand Raj (Sedan)',
      email: 'anand@fgdrivo.com',
      phone: '9842111002',
      license: 'TN57-2016-009122',
      vehicleId: 'veh-2',
      lat: 10.3680,
      lng: 77.9740
    },
    {
      id: 'usr-driver-3',
      name: 'Praveen Velu (SUV)',
      email: 'praveen@fgdrivo.com',
      phone: '9842111003',
      license: 'TN57-2015-001289',
      vehicleId: 'veh-3',
      lat: 10.3740,
      lng: 77.9640
    },
    {
      id: 'usr-driver-4',
      name: 'Muthu Krishnan (Mini)',
      email: 'muthu@fgdrivo.com',
      phone: '9842111004',
      license: 'TN57-2020-008741',
      vehicleId: 'veh-4',
      lat: 10.3590,
      lng: 77.9670
    }
  ];

  for (const d of driversData) {
    const user = await prisma.user.upsert({
      where: { phone: d.phone },
      update: {},
      create: {
        id: d.id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        passwordHash: defaultPasswordHash,
        role: ROLES.DRIVER,
        status: 'ACTIVE'
      }
    });

    await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        licenseNumber: d.license,
        kycStatus: 'APPROVED',
        isAvailable: true,
        isShiftActive: true,
        currentLat: d.lat,
        currentLng: d.lng,
        lastLocationUpdate: new Date(),
        rating: 4.9,
        totalTrips: 150,
        assignedVehicleId: d.vehicleId
      }
    });
  }

  // 6. Audit Log
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      actorRole: 'ADMIN',
      action: 'DATABASE_INITIALIZED',
      entityType: 'System',
      entityId: 'seed',
      details: JSON.stringify({ message: 'FG DRIVO Dindigul Fleet and rules seeded into MySQL' })
    }
  });

  console.log('[Seed] FG DRIVO Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
