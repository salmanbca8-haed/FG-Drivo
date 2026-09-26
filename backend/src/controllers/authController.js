const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { logAction } = require('../services/auditService');

/**
 * Register a new user (Customer or Driver)
 */
async function register(req, res, next) {
  try {
    const { name, phone, email, password, role = 'CUSTOMER' } = req.validatedBody;

    // Check if phone or email already registered
    if (isDbConnected() && prisma) {
      try {
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              { phone },
              ...(email ? [{ email }] : [])
            ]
          }
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            error: existing.phone === phone ? 'Phone number already registered.' : 'Email already registered.'
          });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
          data: {
            name,
            phone,
            email: email || null,
            passwordHash,
            role
          },
          select: { id: true, name: true, phone: true, email: true, role: true, status: true, createdAt: true }
        });

        // If driver role, create default driver profile
        if (role === 'DRIVER') {
          await prisma.driverProfile.create({
            data: {
              userId: newUser.id,
              licenseNumber: `TN57-${Date.now().toString().slice(-6)}`,
              kycStatus: 'PENDING',
              isAvailable: false,
              isShiftActive: false
            }
          });
        }

        await logAction({
          actorId: newUser.id,
          actorRole: newUser.role,
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: newUser.id,
          details: { name, phone, role }
        });

        const token = jwt.sign({ userId: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({
          success: true,
          message: 'Account created successfully.',
          token,
          user: newUser
        });
      } catch (err) {
        console.warn('[AuthController] Fallback to memory store:', err.message);
      }
    }

    // Memory Store
    const existing = memoryStore.users.find(u => u.phone === phone || (email && u.email === email));
    if (existing) {
      return res.status(409).json({
        success: false,
        error: existing.phone === phone ? 'Phone number already registered.' : 'Email already registered.'
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = {
      id: `usr-${uuidv4().slice(0, 8)}`,
      name,
      phone,
      email: email || `${phone}@fgdrivo.local`,
      passwordHash,
      role,
      status: 'ACTIVE',
      profilePic: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.users.push(newUser);

    if (role === 'DRIVER') {
      memoryStore.driverProfiles.push({
        id: `dp-${Date.now()}`,
        userId: newUser.id,
        licenseNumber: `TN57-${Date.now().toString().slice(-6)}`,
        licenseExpiry: new Date('2032-01-01'),
        kycStatus: 'PENDING',
        isAvailable: false,
        isShiftActive: false,
        currentLat: 10.3673,
        currentLng: 77.9803,
        lastLocationUpdate: new Date(),
        rating: 5.0,
        totalTrips: 0,
        assignedVehicleId: null,
        documentsJson: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await logAction({
      actorId: newUser.id,
      actorRole: newUser.role,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: newUser.id,
      details: { name, phone, role }
    });

    const token = jwt.sign({ userId: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, ...userSafe } = newUser;

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: userSafe
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user (Customer, Driver, Admin, Dispatcher)
 */
async function login(req, res, next) {
  try {
    const { identifier, password } = req.validatedBody;

    let user;
    if (isDbConnected() && prisma) {
      try {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { phone: identifier },
              { email: identifier }
            ]
          }
        });
      } catch (err) {
        user = memoryStore.users.find(u => u.phone === identifier || u.email === identifier);
      }
    } else {
      user = memoryStore.users.find(u => u.phone === identifier || u.email === identifier);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please check your phone/email and password.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please check your phone/email and password.'
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: 'Your account is currently suspended. Please contact FG DRIVO support.'
      });
    }

    // Driver specific checks
    let driverProfile = null;
    let vehicle = null;
    if (user.role === 'DRIVER') {
      if (isDbConnected() && prisma) {
        try {
          driverProfile = await prisma.driverProfile.findUnique({
            where: { userId: user.id },
            include: { assignedVehicle: true }
          });
          if (driverProfile) vehicle = driverProfile.assignedVehicle;
        } catch (e) {
          driverProfile = memoryStore.driverProfiles.find(dp => dp.userId === user.id);
          if (driverProfile) vehicle = memoryStore.vehicles.find(v => v.id === driverProfile.assignedVehicleId);
        }
      } else {
        driverProfile = memoryStore.driverProfiles.find(dp => dp.userId === user.id);
        if (driverProfile) vehicle = memoryStore.vehicles.find(v => v.id === driverProfile.assignedVehicleId);
      }
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    const { passwordHash: _, ...userSafe } = user;

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: userSafe,
      driverProfile: driverProfile ? { ...driverProfile, assignedVehicle: vehicle } : null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current profile with driver/vehicle metadata
 */
async function getProfile(req, res, next) {
  try {
    const user = req.user;
    let driverProfile = null;
    let assignedVehicle = null;

    if (user.role === 'DRIVER') {
      if (isDbConnected() && prisma) {
        try {
          driverProfile = await prisma.driverProfile.findUnique({
            where: { userId: user.id },
            include: { assignedVehicle: true }
          });
          if (driverProfile) assignedVehicle = driverProfile.assignedVehicle;
        } catch (e) {
          driverProfile = memoryStore.driverProfiles.find(dp => dp.userId === user.id);
          if (driverProfile) assignedVehicle = memoryStore.vehicles.find(v => v.id === driverProfile.assignedVehicleId);
        }
      } else {
        driverProfile = memoryStore.driverProfiles.find(dp => dp.userId === user.id);
        if (driverProfile) assignedVehicle = memoryStore.vehicles.find(v => v.id === driverProfile.assignedVehicleId);
      }
    }

    return res.json({
      success: true,
      user,
      driverProfile: driverProfile ? { ...driverProfile, assignedVehicle } : null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getProfile
};
