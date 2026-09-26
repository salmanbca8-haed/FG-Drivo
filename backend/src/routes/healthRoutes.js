const express = require('express');
const router = express.Router();
const { checkDbHealth } = require('../db/prisma');

router.get('/', async (req, res) => {
  try {
    const dbHealth = await checkDbHealth();
    const systemStatus = {
      status: 'UP',
      service: 'FG DRIVO Dindigul Core API',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbHealth,
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    };

    const httpCode = dbHealth.status === 'UP' ? 200 : 200; // Return 200 with clear status details
    return res.status(httpCode).json(systemStatus);
  } catch (err) {
    return res.status(500).json({
      status: 'ERROR',
      service: 'FG DRIVO Core API',
      error: 'Health check probe failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
