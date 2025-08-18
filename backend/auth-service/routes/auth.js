const express = require('express');
const Joi = require('joi');
const AuthController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('admin', 'finance', 'operations', 'client', 'support').default('client'),
  clientId: Joi.string().uuid().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  twoFactorCode: Joi.string().length(6).pattern(/^[0-9]+$/).optional(),
  remember: Joi.boolean().default(false)
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional()
});

// Routes
router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshTokenSchema), AuthController.refreshToken);
router.post('/logout', validate(logoutSchema), AuthController.logout);

// Protected routes (require authentication)
router.get('/me', authenticate, (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: {
        id: req.user.userId,
        role: req.user.role,
        clientId: req.user.clientId,
        permissions: req.user.permissions
      }
    }
  });
});

module.exports = router;