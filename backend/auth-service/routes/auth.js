const express = require("express");
const Joi = require("joi");
const AuthController = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const { authenticate, enrichUserContext } = require("../middleware/auth");
const {
  registrationLimiter,
  loginLimiter,
} = require("../middleware/rateLimiter");
const { authMiddleware: sharedAuthMiddleware } = require("../shared/lib/auth");

const router = express.Router();

// Validation schemas for user listing
const listUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  role: Joi.string()
    .valid(
      "superadmin",
      "admin",
      "client",
      "accounts",
      "sales",
      "support",
      "customer",
      "customer_account",
      "customer_sales",
      "customer_support",
      "outlet_admin",
      "outlet_staff",
      "affiliate",
    )
    .optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().min(1).max(255).optional(),
  sortBy: Joi.string()
    .valid("createdAt", "updatedAt", "email", "role")
    .optional()
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").optional().default("desc"),
});

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

// Validation schemas for public registration (direct customer signup)
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
  // Accept either name or firstName+lastName
  name: Joi.string().min(2).max(100).optional(),
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .allow(null, ""),
  // Note: role is ignored for public signup - always enforced as 'customer'
}).or("name", "firstName"); // Require at least name OR firstName;

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
  AuthController.register,
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
  AuthController.login,
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
  AuthController.refreshToken,
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
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.cleanupExpiredSessions,
);
router.post(
  "/admin/blacklist-token",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  validate(blacklistTokenSchema),
  AuthController.blacklistToken,
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
router.get("/me", authenticate, AuthController.getCurrentUser);

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
router.get(
  "/profile",
  authenticate,
  enrichUserContext,
  AuthController.getUserProfile,
);

/**
 * @swagger
 * /auth/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users
 *     description: Retrieve a paginated list of users with filtering and search (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [superadmin, admin, client, accounts, sales, support, customer, customer_account, customer_sales, customer_support, outlet_admin, outlet_staff, affiliate]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email (case-insensitive)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, email, role]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           email:
 *                             type: string
 *                           role:
 *                             type: string
 *                           clientId:
 *                             type: string
 *                             nullable: true
 *                           isActive:
 *                             type: boolean
 *                           twoFactorEnabled:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 50
 *                         totalPages:
 *                           type: integer
 *                           example: 3
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     service:
 *                       type: string
 *                       example: auth-service
 *             example:
 *               status: success
 *               data:
 *                 users:
 *                   - id: 123e4567-e89b-12d3-a456-426614174000
 *                     email: user1@example.com
 *                     role: client
 *                     clientId: CLIENT_001
 *                     isActive: true
 *                     twoFactorEnabled: false
 *                     createdAt: '2024-01-01T00:00:00.000Z'
 *                     updatedAt: '2024-01-01T00:00:00.000Z'
 *                   - id: 223e4567-e89b-12d3-a456-426614174001
 *                     email: user2@example.com
 *                     role: admin
 *                     clientId: null
 *                     isActive: true
 *                     twoFactorEnabled: true
 *                     createdAt: '2024-01-02T00:00:00.000Z'
 *                     updatedAt: '2024-01-02T00:00:00.000Z'
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 50
 *                   totalPages: 3
 *               meta:
 *                 timestamp: '2024-01-10T12:00:00.000Z'
 *                 service: auth-service
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Query validation middleware for list users
const validateQueryParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
          })),
        },
      });
    }

    // Replace query with validated values
    req.query = value;
    next();
  };
};

// List users route (admin only)
router.get(
  "/users",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  validateQueryParams(listUsersSchema),
  AuthController.listUsers,
);

/**
 * @swagger
 * /auth/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user by ID
 *     description: Retrieve detailed information about a specific user by ID (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
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
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         clientId:
 *                           type: string
 *                           nullable: true
 *                         isActive:
 *                           type: boolean
 *                         twoFactorEnabled:
 *                           type: boolean
 *                         parentClientId:
 *                           type: string
 *                           nullable: true
 *                         parentUserId:
 *                           type: string
 *                           nullable: true
 *                         accessLevel:
 *                           type: string
 *                           nullable: true
 *                         licenseId:
 *                           type: string
 *                           nullable: true
 *                         isLicenseActive:
 *                           type: boolean
 *                           nullable: true
 *                         licenseValidUntil:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         commissionRate:
 *                           type: number
 *                           nullable: true
 *                         commissionType:
 *                           type: string
 *                           nullable: true
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *             example:
 *               status: success
 *               data:
 *                 user:
 *                   id: bd40eb4e-d90a-4699-9131-ff797c625231
 *                   email: user@example.com
 *                   role: client
 *                   clientId: CLIENT_001
 *                   isActive: true
 *                   twoFactorEnabled: false
 *                   parentClientId: null
 *                   parentUserId: null
 *                   accessLevel: standard
 *                   licenseId: LIC_001
 *                   isLicenseActive: true
 *                   licenseValidUntil: '2025-12-31T23:59:59.999Z'
 *                   commissionRate: 5.0
 *                   commissionType: percentage
 *                   createdAt: '2024-01-01T00:00:00.000Z'
 *                   updatedAt: '2024-01-01T00:00:00.000Z'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: USER_NOT_FOUND
 *                     message:
 *                       type: string
 *                       example: User not found
 */
// Get user by ID route (admin only)
router.get(
  "/users/:id",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.getUserById,
);

/**
 * @swagger
 * /auth/users:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new user
 *     description: Create a new user account (admin/superadmin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [superadmin, admin, client, accounts, sales, support, customer, customer_account, customer_sales, customer_support, outlet_admin, outlet_staff, affiliate]
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               parentClientId:
 *                 type: string
 *                 format: uuid
 *               parentUserId:
 *                 type: string
 *                 format: uuid
 *               licenseId:
 *                 type: string
 *               accessLevel:
 *                 type: string
 *                 enum: [FULL, RESTRICTED]
 *               assignedCustomerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               commissionRate:
 *                 type: number
 *               commissionType:
 *                 type: string
 *                 enum: [FLAT, PERCENTAGE]
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: User already exists
 */
// Create user route (admin only)
router.post(
  "/users",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.createUser,
);

/**
 * @swagger
 * /auth/users/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update user by ID
 *     description: Update user information including role, status, and other details (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *               clientId:
 *                 type: string
 *                 nullable: true
 *               parentClientId:
 *                 type: string
 *                 nullable: true
 *               parentUserId:
 *                 type: string
 *                 nullable: true
 *               licenseId:
 *                 type: string
 *                 nullable: true
 *               accessLevel:
 *                 type: string
 *                 nullable: true
 *               commissionRate:
 *                 type: number
 *                 nullable: true
 *               commissionType:
 *                 type: string
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *               password:
 *                 type: string
 *                 description: New password (optional)
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 */
// Update user by ID route (admin only)
router.put(
  "/users/:id",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.updateUser,
);

/**
 * @swagger
 * /auth/users/{id}/deactivate:
 *   post:
 *     tags: [Admin]
 *     summary: Deactivate user
 *     description: Deactivate a user account (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 */
// Deactivate user route (admin only)
router.post(
  "/users/:id/deactivate",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.deactivateUser,
);

/**
 * @swagger
 * /auth/users/{id}/activate:
 *   post:
 *     tags: [Admin]
 *     summary: Activate user
 *     description: Activate a user account (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User activated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 */
// Activate user route (admin only)
router.post(
  "/users/:id/activate",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.activateUser,
);

/**
 * @swagger
 * /auth/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete user
 *     description: Permanently delete a user account (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 */
// Delete user route (admin only)
router.delete(
  "/users/:id",
  authenticate,
  sharedAuthMiddleware.requirePermission("user", "manage", "all"),
  AuthController.deleteUser,
);

/**
 * @swagger
 * /auth/internal/users:
 *   post:
 *     tags: [Internal]
 *     summary: Create user (internal service-to-service)
 *     description: Create a new user account via internal service call. Requires INTERNAL_SECRET header.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [outlet_admin, outlet_staff, customer]
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Missing or invalid internal secret
 *       403:
 *         description: Forbidden - not an internal request
 */
// Middleware to verify internal service requests
const verifyInternalRequest = (req, res, next) => {
  const internalSecret = req.headers["x-internal-request"];
  if (!internalSecret || internalSecret !== process.env.INTERNAL_SECRET) {
    return res.status(403).json({
      status: "error",
      error: {
        code: "FORBIDDEN",
        message: "Internal service access only",
      },
    });
  }
  next();
};

// Internal user creation (service-to-service only)
router.post(
  "/internal/users",
  verifyInternalRequest,
  authenticate, // Still require JWT for audit trail
  AuthController.createUser, // Use existing createUser logic
);

/**
 * @swagger
 * /auth/internal/users/{id}:
 *   put:
 *     tags: [Internal]
 *     summary: Update user (internal service-to-service)
 *     description: Update user account via internal service call. Requires INTERNAL_SECRET header.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Missing or invalid internal secret
 *       403:
 *         description: Forbidden - not an internal request
 *       404:
 *         description: User not found
 */
// Internal user update (service-to-service only)
router.put(
  "/internal/users/:id",
  verifyInternalRequest,
  authenticate, // Still require JWT for audit trail
  AuthController.updateUser, // Use existing updateUser logic
);

module.exports = router;
