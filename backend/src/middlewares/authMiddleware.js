const jwt = require('jsonwebtoken');
const { prisma, memoryStore, isDbConnected } = require('../db/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'fg_drivo_secure_jwt_secret_dindigul_2026_x89f';

/**
 * Authentication middleware that verifies JWT bearer tokens
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user info
    let user;
    if (isDbConnected() && prisma) {
      try {
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, email: true, phone: true, role: true, status: true }
        });
      } catch (err) {
        user = memoryStore.users.find(u => u.id === decoded.userId);
      }
    } else {
      user = memoryStore.users.find(u => u.id === decoded.userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or session invalid.'
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact FG DRIVO support.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.'
    });
  }
}

/**
 * Optional authentication: attaches user if token is valid, doesn't block if absent
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let user;
    if (isDbConnected() && prisma) {
      try {
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, email: true, phone: true, role: true, status: true }
        });
      } catch (err) {
        user = memoryStore.users.find(u => u.id === decoded.userId);
      }
    } else {
      user = memoryStore.users.find(u => u.id === decoded.userId);
    }
    if (user && user.status !== 'SUSPENDED') {
      req.user = user;
    }
  } catch (err) {
    // Ignore invalid optional tokens
  }
  next();
}

module.exports = {
  authenticateToken,
  optionalAuth,
  JWT_SECRET
};
