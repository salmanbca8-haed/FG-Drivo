const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, registerSchema, loginSchema } = require('../middlewares/validationMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router;
