require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const driverRoutes = require('./routes/driverRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fareRoutes = require('./routes/fareRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportRoutes = require('./routes/supportRoutes');

const { setupSocketIO } = require('./sockets/socketHandler');
const { errorHandler } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();
const server = http.createServer(app);

// Socket.IO Setup
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173').split(',');

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Pass io to Express app
app.set('io', io);

// Security & Parsing Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow local dev
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general API rate limiter
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fares', fareRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);

// Root Welcome
app.get('/', (req, res) => {
  res.json({
    service: 'FG DRIVO Taxi Booking API (Dindigul, TN)',
    status: 'OPERATIONAL',
    portals: {
      customer: 'Customer Booking & Real-Time Tracking Portal',
      driver: 'Driver Duty, OTP Verification & GPS Navigation Portal',
      admin: 'Central Dispatch, Fleet & Fare Management Portal'
    },
    version: '1.0.0'
  });
});

// Central Error Handler
app.use(errorHandler);

// Setup Socket.IO Event Handlers
setupSocketIO(io);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`\n🚕 FG DRIVO Backend Server running on http://localhost:${PORT}`);
    console.log(`📍 Serving Dindigul City (Center: 10.3673, 77.9803 | Radius: 25km)`);
    console.log(`⚡ Real-Time Socket.IO initialized\n`);
  });
}

module.exports = { app, server, io };
