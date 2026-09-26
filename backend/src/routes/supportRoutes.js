const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/rbacMiddleware');

router.post('/tickets', authenticateToken, supportController.createTicket);
router.get('/my-tickets', authenticateToken, supportController.getCustomerTickets);
router.get('/admin/tickets', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), supportController.getAllTickets);
router.patch('/admin/tickets/:ticketId', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), supportController.updateTicket);

module.exports = router;
