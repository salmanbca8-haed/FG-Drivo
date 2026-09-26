const { prisma, memoryStore, isDbConnected } = require('../db/prisma');
const { logAction } = require('../services/auditService');

/**
 * Submit a customer support ticket
 */
async function createTicket(req, res, next) {
  try {
    const customerId = req.user.id;
    const { subject, message, bookingId, priority = 'MEDIUM' } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message are required.' });
    }

    const ticketRef = `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (isDbConnected() && prisma) {
      try {
        const ticket = await prisma.supportTicket.create({
          data: {
            ticketRef,
            customerId,
            bookingId: bookingId || null,
            subject,
            message,
            priority,
            status: 'OPEN'
          },
          include: { customer: { select: { id: true, name: true, phone: true } } }
        });
        return res.status(201).json({ success: true, ticket });
      } catch (err) {
        console.warn('[SupportController] Fallback to memory for ticket creation:', err.message);
      }
    }

    const ticket = {
      id: `tkt-${Date.now()}`,
      ticketRef,
      customerId,
      bookingId: bookingId || null,
      subject,
      message,
      priority,
      status: 'OPEN',
      resolutionNotes: null,
      assignedStaffId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.supportTickets.unshift(ticket);

    await logAction({
      actorId: customerId,
      actorRole: req.user.role,
      action: 'SUPPORT_TICKET_CREATED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      details: { ticketRef, subject }
    });

    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

/**
 * Get customer's tickets
 */
async function getCustomerTickets(req, res, next) {
  try {
    const customerId = req.user.id;

    if (isDbConnected() && prisma) {
      try {
        const tickets = await prisma.supportTicket.findMany({
          where: { customerId },
          orderBy: { createdAt: 'desc' }
        });
        return res.json({ success: true, tickets });
      } catch (err) {
        // fallback
      }
    }

    const tickets = memoryStore.supportTickets.filter(t => t.customerId === customerId);
    return res.json({ success: true, tickets });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all tickets (Admin view)
 */
async function getAllTickets(req, res, next) {
  try {
    if (isDbConnected() && prisma) {
      try {
        const tickets = await prisma.supportTicket.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            booking: { select: { id: true, bookingRef: true, status: true } }
          }
        });
        return res.json({ success: true, tickets });
      } catch (err) {
        // fallback
      }
    }

    const tickets = memoryStore.supportTickets.map(t => ({
      ...t,
      customer: memoryStore.users.find(u => u.id === t.customerId),
      booking: t.bookingId ? memoryStore.bookings.find(b => b.id === t.bookingId) : null
    }));

    return res.json({ success: true, tickets });
  } catch (error) {
    next(error);
  }
}

/**
 * Update ticket resolution (Admin action)
 */
async function updateTicket(req, res, next) {
  try {
    const { ticketId } = req.params;
    const { status, resolutionNotes } = req.body;

    if (isDbConnected() && prisma) {
      try {
        const updated = await prisma.supportTicket.update({
          where: { id: ticketId },
          data: {
            status,
            resolutionNotes,
            assignedStaffId: req.user.id
          }
        });
        return res.json({ success: true, ticket: updated });
      } catch (err) {
        // fallback
      }
    }

    const t = memoryStore.supportTickets.find(ticket => ticket.id === ticketId);
    if (!t) return res.status(404).json({ success: false, error: 'Ticket not found' });

    t.status = status || t.status;
    t.resolutionNotes = resolutionNotes || t.resolutionNotes;
    t.assignedStaffId = req.user.id;
    t.updatedAt = new Date();

    return res.json({ success: true, ticket: t });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTicket,
  getCustomerTickets,
  getAllTickets,
  updateTicket
};
