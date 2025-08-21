// User Service - User Profile Routes
// RESTful API routes for user profile management with authentication and validation

const express = require("express");
const UserController = require("../controllers/userController");
const auth = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const {
  validateCreateProfile,
  validateUpdateProfile,
  validatePaginationQuery,
  validateUuidParam,
} = require("../middleware/validate");

const router = express.Router();

// Profile management routes

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Create a new user profile
 *     description: Creates a new user profile for the authenticated user. Each user can only have one profile.
 *     tags: [User Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserProfileRequest'
 *           example:
 *             userId: "123e4567-e89b-12d3-a456-426614174000"
 *             firstName: "John"
 *             lastName: "Doe"
 *             email: "john.doe@example.com"
 *             phone: "+1234567890"
 *             timezone: "America/New_York"
 *             language: "en"
 *             clientId: "CLIENT_001"
 *     responses:
 *       201:
 *         description: User profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Validation error or profile already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Profile already exists for this user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/profiles",
  auth.authenticate,
  validateCreateProfile,
  asyncHandler(UserController.createProfile),
);

/**
 * @swagger
 * /api/profiles/me:
 *   get:
 *     summary: Get current user's profile
 *     description: Retrieves the profile of the currently authenticated user
 *     tags: [User Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found for current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/profiles/me",
  auth.authenticate,
  asyncHandler(UserController.getMyProfile),
);

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: List user profiles with pagination
 *     description: Retrieves a paginated list of user profiles. Access is restricted based on user role and client association.
 *     tags: [User Profiles]
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
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [firstName, lastName, email, createdAt, updatedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID (admin/support only)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *     responses:
 *       200:
 *         description: Profiles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/profiles",
  auth.authenticate,
  auth.requireClientAccess(["client", "operations", "admin", "support"]),
  validatePaginationQuery,
  asyncHandler(UserController.listProfiles),
);

/**
 * @swagger
 * /api/profiles/{id}:
 *   get:
 *     summary: Get user profile by ID
 *     description: Retrieves a specific user profile by ID. Access is restricted to profile owner, users from same client, or admin/support.
 *     tags: [User Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User profile ID
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/profiles/:id",
  auth.authenticate,
  validateUuidParam,
  asyncHandler(UserController.getProfile),
);

/**
 * @swagger
 * /api/profiles/{id}:
 *   put:
 *     summary: Update user profile
 *     description: Updates a user profile. Access is restricted to profile owner, operations from same client, or admin.
 *     tags: [User Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User profile ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserProfileRequest'
 *           example:
 *             firstName: "John"
 *             lastName: "Smith"
 *             phone: "+1234567890"
 *             timezone: "America/Los_Angeles"
 *             language: "en"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: Delete user profile (soft delete)
 *     description: Soft deletes a user profile. Only the profile owner or admin can delete profiles.
 *     tags: [User Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User profile ID
 *     responses:
 *       200:
 *         description: Profile deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  "/profiles/:id",
  auth.authenticate,
  validateUuidParam,
  validateUpdateProfile,
  asyncHandler(UserController.updateProfile),
);

router.delete(
  "/profiles/:id",
  auth.authenticate,
  auth.requireRole(["admin", "client"]), // Only admin or profile owner
  validateUuidParam,
  asyncHandler(UserController.deleteProfile),
);

// Admin-only routes

/**
 * @swagger
 * /api/admin/profiles:
 *   get:
 *     summary: Admin view of all user profiles
 *     description: Retrieves a paginated list of all user profiles across all clients. Admin access only.
 *     tags: [Admin]
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
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *     responses:
 *       200:
 *         description: Profiles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   GET /api/admin/profiles
 * @desc    Admin view of all profiles across all clients
 * @access  Private (admin only)
 */
router.get(
  "/admin/profiles",
  auth.adminOnly,
  validatePaginationQuery,
  asyncHandler(UserController.listProfiles),
);

/**
 * @swagger
 * /api/admin/profiles/{id}/verify:
 *   put:
 *     summary: Admin verify user profile
 *     description: Allows admin to verify a user profile, marking it as verified in the system
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User profile ID
 *     responses:
 *       200:
 *         description: Profile verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   PUT /api/admin/profiles/:id/verify
 * @desc    Admin verify user profile
 * @access  Private (admin only)
 */
router.put(
  "/admin/profiles/:id/verify",
  auth.adminOnly,
  validateUuidParam,
  asyncHandler(UserController.verifyProfile),
);

/**
 * @swagger
 * /api/admin/profiles/{id}/activate:
 *   put:
 *     summary: Admin activate/deactivate user profile
 *     description: Allows admin to toggle the active status of a user profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User profile ID
 *     responses:
 *       200:
 *         description: Profile activation status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         profile:
 *                           $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   PUT /api/admin/profiles/:id/activate
 * @desc    Admin activate/deactivate user profile
 * @access  Private (admin only)
 */
router.put(
  "/admin/profiles/:id/activate",
  auth.adminOnly,
  validateUuidParam,
  asyncHandler(UserController.toggleProfileActivation),
);

// Support routes

/**
 * @swagger
 * /api/support/profiles/search:
 *   get:
 *     summary: Support search profiles for customer assistance
 *     description: Allows support staff to search user profiles for customer assistance purposes
 *     tags: [Admin]
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
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID
 *     responses:
 *       200:
 *         description: Profiles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Support or admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   GET /api/support/profiles/search
 * @desc    Support search profiles for customer assistance
 * @access  Private (support or admin)
 */
router.get(
  "/support/profiles/search",
  auth.requireRole(["support", "admin"]),
  validatePaginationQuery,
  asyncHandler(UserController.listProfiles),
);

// Client-specific routes

/**
 * @swagger
 * /api/clients/{clientId}/profiles:
 *   get:
 *     summary: Get all profiles for a specific client
 *     description: Retrieves all user profiles belonging to a specific client. Access restricted to admin, support, or operations from the same client.
 *     tags: [User Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *         example: "CLIENT_001"
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
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name or email
 *     responses:
 *       200:
 *         description: Client profiles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   GET /api/clients/:clientId/profiles
 * @desc    Get all profiles for a specific client
 * @access  Private (admin, support, or operations from same client)
 */
router.get(
  "/clients/:clientId/profiles",
  auth.authenticate,
  auth.requireClientAccess(["operations", "admin", "support"]),
  auth.requireOwnClientOrAdmin,
  validatePaginationQuery,
  asyncHandler(async (req, res) => {
    // Add clientId to query for filtering
    req.query.clientId = req.params.clientId;
    return UserController.listProfiles(req, res);
  }),
);

// Health and utility routes

/**
 * @swagger
 * /api/profiles/stats:
 *   get:
 *     summary: Get profile statistics
 *     description: Retrieves comprehensive statistics about user profiles including counts by status, client, and other metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         stats:
 *                           type: object
 *                           properties:
 *                             totalProfiles:
 *                               type: integer
 *                               description: Total number of profiles
 *                               example: 1250
 *                             activeProfiles:
 *                               type: integer
 *                               description: Number of active profiles
 *                               example: 1100
 *                             verifiedProfiles:
 *                               type: integer
 *                               description: Number of verified profiles
 *                               example: 950
 *                             profilesByClient:
 *                               type: object
 *                               description: Profile counts by client
 *                               example:
 *                                 CLIENT_001: 500
 *                                 CLIENT_002: 300
 *                             recentProfiles:
 *                               type: integer
 *                               description: Profiles created in last 30 days
 *                               example: 45
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Operations access or higher required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   GET /api/profiles/stats
 * @desc    Get profile statistics
 * @access  Private (operations or higher)
 */
router.get(
  "/profiles/stats",
  auth.requireRole(["operations", "finance", "admin", "support"]),
  asyncHandler(UserController.getProfileStats),
);

module.exports = router;
