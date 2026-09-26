const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { BOOKING_STATUS } = require('../config/constants');

function setupSocketIO(io) {
  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      let user;

      if (isDbConnected() && prisma) {
        try {
          user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, name: true, phone: true, role: true, status: true }
          });
        } catch (e) {
          user = memoryStore.users.find(u => u.id === decoded.userId);
        }
      } else {
        user = memoryStore.users.find(u => u.id === decoded.userId);
      }

      if (!user || user.status === 'SUSPENDED') {
        return next(new Error('Authentication error: User invalid or suspended'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket] Connected: ${user.name} (${user.role}) - Socket ID: ${socket.id}`);

    // Join personal user notification room
    socket.join(`user_${user.id}`);

    // Role-based room subscriptions
    if (user.role === 'ADMIN' || user.role === 'DISPATCHER') {
      socket.join('admin_dispatch');
      console.log(`[Socket] User ${user.name} joined admin_dispatch room`);
    } else if (user.role === 'DRIVER') {
      socket.join(`driver_${user.id}`);
      console.log(`[Socket] Driver ${user.name} joined driver_${user.id} room`);
    } else if (user.role === 'CUSTOMER') {
      socket.join(`customer_${user.id}`);
    }

    // Join specific booking room with permission verification
    socket.on('join_booking_room', async ({ bookingId }) => {
      if (!bookingId) return;

      let booking;
      if (isDbConnected() && prisma) {
        try {
          booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        } catch (e) {
          booking = memoryStore.bookings.find(b => b.id === bookingId);
        }
      } else {
        booking = memoryStore.bookings.find(b => b.id === bookingId);
      }

      if (!booking) {
        return socket.emit('error_message', { message: 'Booking not found' });
      }

      // Authorization check: only customer of booking, assigned driver, or admin/dispatcher can join
      const isAuthorized =
        user.role === 'ADMIN' ||
        user.role === 'DISPATCHER' ||
        booking.customerId === user.id ||
        booking.driverId === user.id;

      if (isAuthorized) {
        socket.join(`booking_${bookingId}`);
        socket.emit('joined_booking_room', { bookingId, status: booking.status });
      } else {
        socket.emit('error_message', { message: 'Unauthorized to track this booking' });
      }
    });

    // Leave booking room
    socket.on('leave_booking_room', ({ bookingId }) => {
      if (bookingId) {
        socket.leave(`booking_${bookingId}`);
      }
    });

    // Live GPS Location Stream from Driver
    socket.on('driver_gps_update', async (data) => {
      try {
        if (user.role !== 'DRIVER') {
          return socket.emit('error_message', { message: 'Only authenticated drivers can broadcast GPS.' });
        }

        const { bookingId, lat, lng, speed = 0, heading = 0 } = data;
        if (!lat || !lng) return;

        let booking = null;
        if (bookingId) {
          if (isDbConnected() && prisma) {
            try {
              booking = await prisma.booking.findUnique({ where: { id: bookingId } });
            } catch (e) {
              booking = memoryStore.bookings.find(b => b.id === bookingId);
            }
          } else {
            booking = memoryStore.bookings.find(b => b.id === bookingId);
          }
        }

        // Update driver's last known location in profile
        const updatePayload = {
          currentLat: lat,
          currentLng: lng,
          lastLocationUpdate: new Date()
        };

        if (isDbConnected() && prisma) {
          try {
            await prisma.driverProfile.updateMany({
              where: { userId: user.id },
              data: updatePayload
            });

            if (booking && [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED].includes(booking.status)) {
              await prisma.locationLog.create({
                data: {
                  bookingId: booking.id,
                  driverId: user.id,
                  lat,
                  lng,
                  speed: Number(speed),
                  heading: Number(heading),
                  recordedAt: new Date()
                }
              });
            }
          } catch (e) {
            // silent catch
          }
        } else {
          const dp = memoryStore.driverProfiles.find(d => d.userId === user.id);
          if (dp) {
            dp.currentLat = lat;
            dp.currentLng = lng;
            dp.lastLocationUpdate = new Date();
          }
          if (booking && [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED].includes(booking.status)) {
            memoryStore.locationLogs.push({
              id: `loc-${Date.now()}`,
              bookingId: booking.id,
              driverId: user.id,
              lat,
              lng,
              speed,
              heading,
              recordedAt: new Date()
            });
          }
        }

        const locationPacket = {
          driverId: user.id,
          driverName: user.name,
          bookingId: bookingId || null,
          lat,
          lng,
          speed,
          heading,
          recordedAt: new Date().toISOString()
        };

        // Broadcast to specific booking room if active
        if (bookingId && booking && [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.DRIVER_ARRIVED, BOOKING_STATUS.TRIP_STARTED].includes(booking.status)) {
          io.to(`booking_${bookingId}`).emit('ride:location_update', locationPacket);
        }

        // Broadcast to dispatch map
        io.to('admin_dispatch').emit('dispatch:driver_location', locationPacket);
      } catch (err) {
        console.error('[Socket GPS Error]', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.name} (${socket.id})`);
    });
  });
}

module.exports = {
  setupSocketIO
};
