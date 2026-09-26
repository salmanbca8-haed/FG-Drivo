const { PrismaClient } = require('@prisma/client');
const memoryStore = require('./memoryStore');

let prisma;
let isConnected = false;
let lastCheckError = null;

try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
} catch (err) {
  console.warn('[DB] Prisma Client initialization note:', err.message);
}

/**
 * Health check function that tests database connection safely
 * Never exposes credentials or secrets
 */
async function checkDbHealth() {
  const startTime = Date.now();
  try {
    if (!prisma) {
      throw new Error('Prisma Client not initialized');
    }
    // Perform light query
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    isConnected = true;
    lastCheckError = null;
    return {
      status: 'UP',
      provider: 'MySQL',
      database: 'fg_drivo',
      latencyMs: latency,
      connected: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    isConnected = false;
    lastCheckError = error.message;
    return {
      status: 'DOWN',
      provider: 'MySQL',
      database: 'fg_drivo',
      latencyMs: Date.now() - startTime,
      connected: false,
      errorSnippet: 'Database connection unreachable or not running.',
      fallbackActive: true,
      setupInstruction: 'To use live MySQL: 1. Start MySQL server (e.g. XAMPP/Docker/MySQL Service). 2. Create database `fg_drivo`. 3. Set DATABASE_URL in .env. 4. Run `npm run prisma:push`.',
      timestamp: new Date().toISOString()
    };
  }
}

// Initial async check on startup
checkDbHealth().then(health => {
  if (health.status === 'UP') {
    console.log(`[DB] Connected successfully to MySQL (${health.latencyMs}ms)`);
  } else {
    console.warn(`[DB] MySQL server offline. Memory store active with preloaded Dindigul fleet and demo data.`);
  }
}).catch(() => {
  console.warn('[DB] Memory fallback mode active.');
});

module.exports = {
  prisma,
  memoryStore,
  checkDbHealth,
  isDbConnected: () => isConnected
};
