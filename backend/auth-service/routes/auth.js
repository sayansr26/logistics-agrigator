const express = require("express");
const Joi = require("joi");
const AuthController = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const {
  authenticate,
  authorize,
  requireRole,
  enrichUserContext,
  adminOnly,
  operationsOrHigher,
} = require("../middleware/auth");
const {
  registrationLimiter,
  loginLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

/**
 * @swagger
 * components:
 *   responses:
 *     UnauthorizedError:
 *       description: Authentication information is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             status: error
 *             error:
 *               code: UNAUTHORIZED
 *               message: Access denied. No token provided.
 *     ForbiddenError:
 *       description: User doesn't have permission to access this resource
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             status: error
 *             error:
 *               code: FORBIDDEN
 *               message: Insufficient permissions.
 *     ValidationError:
 *       description: Request validation failed
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             status: error
 *             error:
 *               code: VALIDATION_ERROR
 *               message: Invalid email format
 *               field: email
 */

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    }),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string()
    .valid("admin", "finance", "operations", "client", "support")
    .default("client"),
  clientId: Joi.string().uuid().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  twoFactorCode: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .optional(),
  remember: Joi.boolean().default(false),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional(),
  accessToken: Joi.string().optional(),
});

const blacklistTokenSchema = Joi.object({
  token: Joi.string().required(),
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: newuser@example.com
 *             password: SecurePassword123!
 *             name: John Doe
 *             role: client
 *             clientId: CLIENT_001
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               status: error
 *               error:
 *                 code: USER_EXISTS
 *                 message: User with this email already exists
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Routes
router.post(
  "/register",
  registrationLimiter,
  validate(registerSchema),
  AuthController.register
);
/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: user@example.com
 *             password: SecurePassword123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               status: error
 *               error:
 *                 code: INVALID_CREDENTIALS
 *                 message: Invalid email or password
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  AuthController.login
);
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: Get a new access token using a valid refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               status: error
 *               error:
 *                 code: INVALID_REFRESH_TOKEN
 *                 message: Invalid or expired refresh token
 */
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  AuthController.refreshToken
);
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: User logout
 *     description: Logout user and invalidate tokens
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *             accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Logged out successfully
 *                     details:
 *                       type: object
 *                       properties:
 *                         sessionDeleted:
 *                           type: boolean
 *                         tokenBlacklisted:
 *                           type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post("/logout", validate(logoutSchema), AuthController.logout);
/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout from all devices
 *     description: Logout user from all devices and invalidate all sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout from all devices successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Logged out from all devices successfully
 *                     deletedSessions:
 *                       type: number
 *                       description: Number of sessions deleted
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/logout-all", authenticate, AuthController.logoutAllDevices);

/**
 * @swagger
 * /auth/admin/cleanup-sessions:
 *   post:
 *     tags: [Admin]
 *     summary: Cleanup expired sessions
 *     description: Remove expired sessions from the database (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Expired sessions cleaned up successfully
 *                     deletedSessions:
 *                       type: number
 *                       description: Number of expired sessions deleted
 *                       example: 12
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
/**
 * @swagger
 * /auth/admin/blacklist-token:
 *   post:
 *     tags: [Admin]
 *     summary: Blacklist a token
 *     description: Add a token to the blacklist to prevent its usage (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: JWT token to blacklist
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *           example:
 *             token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token blacklisted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Token blacklisted successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Admin routes (require authentication and admin role)
router.post(
  "/admin/cleanup-sessions",
  authenticate,
  adminOnly,
  AuthController.cleanupExpiredSessions
);
router.post(
  "/admin/blacklist-token",
  authenticate,
  adminOnly,
  validate(blacklistTokenSchema),
  AuthController.blacklistToken
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Authorization]
 *     summary: Get current user info
 *     description: Get basic information about the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: 123e4567-e89b-12d3-a456-426614174000
 *                         role:
 *                           type: string
 *                           enum: [admin, finance, operations, client, support]
 *                           example: client
 *                         clientId:
 *                           type: string
 *                           nullable: true
 *                           example: CLIENT_001
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: [own_shipments, tracking, wallet_view]
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Protected routes (require authentication)
router.get("/me", authenticate, (req, res) => {
  res.json({
    status: "success",
    data: {
      user: {
        id: req.user.userId,
        role: req.user.role,
        clientId: req.user.clientId,
        permissions: req.user.permissions,
      },
    },
  });
});

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     tags: [Authorization]
 *     summary: Get enhanced user profile
 *     description: Get user profile with enriched context including capabilities and permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         role:
 *                           type: string
 *                           enum: [admin, finance, operations, client, support]
 *                         clientId:
 *                           type: string
 *                           nullable: true
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                         isAdmin:
 *                           type: boolean
 *                         canAccessAll:
 *                           type: boolean
 *                         capabilities:
 *                           type: object
 *                           properties:
 *                             canManageUsers:
 *                               type: boolean
 *                             canViewReports:
 *                               type: boolean
 *                             canManageShipments:
 *                               type: boolean
 *                             canAccessWallet:
 *                               type: boolean
 *                             canProvideSupport:
 *                               type: boolean
 *                         requestTimestamp:
 *                           type: string
 *                           format: date-time
 *             example:
 *               status: success
 *               data:
 *                 user:
 *                   id: 123e4567-e89b-12d3-a456-426614174000
 *                   role: client
 *                   clientId: CLIENT_001
 *                   permissions: [own_shipments, tracking, wallet_view]
 *                   isAdmin: false
 *                   canAccessAll: false
 *                   capabilities:
 *                     canManageUsers: false
 *                     canViewReports: false
 *                     canManageShipments: false
 *                     canAccessWallet: true
 *                     canProvideSupport: false
 *                   requestTimestamp: '2024-01-01T00:00:00.000Z'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Enhanced user profile with capabilities
router.get("/profile", authenticate, enrichUserContext, (req, res) => {
  res.json({
    status: "success",
    data: {
      user: {
        id: req.user.userId,
        role: req.user.role,
        clientId: req.user.clientId,
        permissions: req.user.permissions,
        isAdmin: req.user.isAdmin,
        canAccessAll: req.user.canAccessAll,
        capabilities: req.user.capabilities,
        requestTimestamp: req.user.requestTimestamp,
      },
    },
  });
});

module.exports = router;
