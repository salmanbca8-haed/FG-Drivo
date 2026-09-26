const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates an audit log entry
 */
async function logAction({
  actorId = null,
  actorRole = 'SYSTEM',
  action,
  entityType,
  entityId = null,
  details = {},
  ipAddress = '127.0.0.1'
}) {
  const logEntry = {
    id: `aud-${uuidv4()}`,
    actorId,
    actorRole,
    action,
    entityType,
    entityId,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    ipAddress,
    createdAt: new Date()
  };

  if (isDbConnected() && prisma) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          actorRole,
          action,
          entityType,
          entityId,
          details: logEntry.details,
          ipAddress
        }
      });
      return logEntry;
    } catch (err) {
      console.warn('[AuditService] Failed DB insert, fallback to memory:', err.message);
    }
  }

  // Memory store fallback
  memoryStore.auditLogs.unshift(logEntry);
  if (memoryStore.auditLogs.length > 500) {
    memoryStore.auditLogs.pop();
  }
  return logEntry;
}

/**
 * Retrieves audit logs with optional filtering
 */
async function getAuditLogs({ limit = 50, action = null, actorRole = null }) {
  if (isDbConnected() && prisma) {
    try {
      const where = {};
      if (action) where.action = action;
      if (actorRole) where.actorRole = actorRole;

      return await prisma.auditLog.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true, phone: true }
          }
        }
      });
    } catch (err) {
      console.warn('[AuditService] Failed DB fetch, fallback to memory:', err.message);
    }
  }

  let logs = [...memoryStore.auditLogs];
  if (action) logs = logs.filter(l => l.action === action);
  if (actorRole) logs = logs.filter(l => l.actorRole === actorRole);

  return logs.slice(0, limit).map(log => {
    const actor = memoryStore.users.find(u => u.id === log.actorId);
    return {
      ...log,
      actor: actor ? { id: actor.id, name: actor.name, email: actor.email, phone: actor.phone } : null
    };
  });
}

module.exports = {
  logAction,
  getAuditLogs
};
