// Client Management Routes
// API routes for client CRUD, settings, and user invitations

const express = require("express");
const { asyncHandler } = require("../middleware/errorHandler");
const auth = require("../middleware/auth");
const {
  validateCreateClient,
  validateUpdateClient,
  validateCreateClientSettings,
  validateUpdateClientSettings,
  validateCreateUserInvitation,
  validateUuidParam,
  validatePaginationQuery,
} = require("../middleware/validate");

// Import controllers
const ClientController = require("../controllers/clientController");
const ClientSettingsController = require("../controllers/clientSettingsController");
const UserInvitationController = require("../controllers/userInvitationController");

const router = express.Router();

// ============================================================================
// CLIENT MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Create a new client
 *     description: Creates a new client in the system. Only administrators can create clients.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientRequest'
 *           example:
 *             id: "CLIENT_001"
 *             name: "Acme Corporation"
 *             email: "contact@acme.com"
 *             phone: "+1234567890"
 *             address: "123 Business St, City, State 12345"
 *             website: "https://acme.com"
 *             industry: "E-commerce"
 *     responses:
 *       201:
 *         description: Client created successfully
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
 *                         client:
 *                           $ref: '#/components/schemas/Client'
 *       400:
 *         description: Validation error or client ID already exists
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
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Client with this ID already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/clients",
  auth.adminOnly,
  validateCreateClient,
  asyncHandler(ClientController.createClient),
);

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: List all clients with pagination
 *     description: Retrieves a paginated list of clients. Access is filtered by role - operations users only see their own client.
 *     tags: [Clients]
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
 *         description: Search term for client name or email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, createdAt, updatedAt]
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *         description: Filter by industry
 *     responses:
 *       200:
 *         description: Clients retrieved successfully
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
 *                             $ref: '#/components/schemas/Client'
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
  "/clients",
  auth.requireRole(["admin", "support", "operations"]),
  validatePaginationQuery,
  asyncHandler(ClientController.listClients),
);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Get client by ID
 *     description: Retrieves a specific client by ID. Access is restricted to admin, support, or users from the same client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *         example: "CLIENT_001"
 *     responses:
 *       200:
 *         description: Client retrieved successfully
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
 *                         client:
 *                           $ref: '#/components/schemas/Client'
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: Update client
 *     description: Updates a client's information. Only admin or operations users from the same client can update.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *         example: "CLIENT_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClientRequest'
 *           example:
 *             name: "Acme Corporation Ltd"
 *             email: "info@acme.com"
 *             phone: "+1234567891"
 *             website: "https://www.acme.com"
 *     responses:
 *       200:
 *         description: Client updated successfully
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
 *                         client:
 *                           $ref: '#/components/schemas/Client'
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/clients/:id",
  auth.authenticate,
  validateUuidParam,
  asyncHandler(ClientController.getClient),
);

router.put(
  "/clients/:id",
  auth.authenticate,
  validateUuidParam,
  validateUpdateClient,
  asyncHandler(ClientController.updateClient),
);

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     summary: Soft delete a client
 *     description: Deactivates a client account. Only administrators can perform this action.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *         example: "CLIENT_001"
 *     responses:
 *       200:
 *         description: Client deactivated successfully
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
 *                         client:
 *                           $ref: '#/components/schemas/Client'
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/clients/:id",
  auth.adminOnly,
  validateUuidParam,
  asyncHandler(ClientController.deleteClient),
);

/**
 * @swagger
 * /api/clients/{id}/activate:
 *   put:
 *     summary: Activate or deactivate a client
 *     description: Toggles the active status of a client account. Only administrators can perform this action.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *         example: "CLIENT_001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Set to true to activate, false to deactivate
 *           example:
 *             isActive: true
 *     responses:
 *       200:
 *         description: Client status updated successfully
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
 *                         client:
 *                           $ref: '#/components/schemas/Client'
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  "/clients/:id/activate",
  auth.adminOnly,
  validateUuidParam,
  asyncHandler(ClientController.activateClient),
);

/**
 * @swagger
 * /api/clients/stats:
 *   get:
 *     summary: Get client statistics
 *     description: Retrieves aggregated statistics about clients. Only accessible by admin and support roles.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                         totalClients:
 *                           type: integer
 *                           description: Total number of clients
 *                           example: 150
 *                         activeClients:
 *                           type: integer
 *                           description: Number of active clients
 *                           example: 142
 *                         inactiveClients:
 *                           type: integer
 *                           description: Number of inactive clients
 *                           example: 8
 *                         clientsByIndustry:
 *                           type: object
 *                           description: Distribution of clients by industry
 *                           example:
 *                             "E-commerce": 45
 *                             "Retail": 35
 *                             "Manufacturing": 30
 *                         clientsCreatedThisMonth:
 *                           type: integer
 *                           description: Number of new clients this month
 *                           example: 12
 *                         averageUsersPerClient:
 *                           type: number
 *                           description: Average number of users per client
 *                           example: 8.5
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - requires admin or support role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/clients/stats",
  auth.requireRole(["admin", "support"]),
  asyncHandler(ClientController.getClientStats),
);

// ============================================================================
// CLIENT SETTINGS ROUTES
// ============================================================================

/**
 * @swagger
 * /api/client-settings:
 *   post:
 *     summary: Create client settings
 *     description: Creates white-label branding and configuration settings for a client. Only admin or operations users can create settings.
 *     tags: [Client Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientSettingsRequest'
 *           example:
 *             clientId: "CLIENT_001"
 *             brandName: "Acme Logistics"
 *             brandLogo: "https://acme.com/logo.png"
 *             brandColors:
 *               primary: "#007bff"
 *               secondary: "#6c757d"
 *             customDomain: "logistics.acme.com"
 *             features:
 *               tracking: true
 *               wallet: true
 *               analytics: false
 *     responses:
 *       201:
 *         description: Client settings created successfully
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
 *                         settings:
 *                           $ref: '#/components/schemas/ClientSettings'
 *       400:
 *         description: Validation error or settings already exist
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
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Settings already exist for this client
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/client-settings",
  auth.requireRole(["admin", "operations"]),
  validateCreateClientSettings,
  asyncHandler(ClientSettingsController.createClientSettings),
);

/**
 * @swagger
 * /api/client-settings/{clientId}:
 *   get:
 *     summary: Get client settings
 *     description: Retrieves white-label branding and configuration settings for a client. Access is restricted to admin, support, or users from the same client.
 *     tags: [Client Settings]
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
 *     responses:
 *       200:
 *         description: Client settings retrieved successfully
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
 *                         settings:
 *                           $ref: '#/components/schemas/ClientSettings'
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
 *         description: Client settings not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/client-settings/:clientId",
  auth.authenticate,
  validateUuidParam,
  asyncHandler(ClientSettingsController.getClientSettings),
);

/**
 * @swagger
 * /api/client-settings/{clientId}:
 *   put:
 *     summary: Update client settings
 *     description: Updates white-label branding and configuration settings for a client
 *     tags: [Client Settings]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brandName:
 *                 type: string
 *                 nullable: true
 *                 description: White-label brand name
 *                 example: "Acme Logistics Pro"
 *               brandLogo:
 *                 type: string
 *                 nullable: true
 *                 format: uri
 *                 description: URL to brand logo
 *                 example: "https://acme.com/new-logo.png"
 *               brandColors:
 *                 type: object
 *                 nullable: true
 *                 description: Brand color scheme
 *                 properties:
 *                   primary:
 *                     type: string
 *                     example: "#0066cc"
 *                   secondary:
 *                     type: string
 *                     example: "#f0f0f0"
 *               customDomain:
 *                 type: string
 *                 nullable: true
 *                 description: Custom domain for white-label portal
 *                 example: "logistics.acme.com"
 *               features:
 *                 type: object
 *                 description: Enabled features for the client
 *                 properties:
 *                   tracking:
 *                     type: boolean
 *                     example: true
 *                   wallet:
 *                     type: boolean
 *                     example: false
 *                   analytics:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Client settings updated successfully
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
 *                         settings:
 *                           $ref: '#/components/schemas/ClientSettings'
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
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Client settings not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * @route   PUT /api/client-settings/:clientId
 * @desc    Update client settings
 * @access  Private (admin or own client operations)
 */
router.put(
  "/client-settings/:clientId",
  auth.requireRole(["admin", "operations"]),
  validateUuidParam,
  validateUpdateClientSettings,
  asyncHandler(ClientSettingsController.updateClientSettings),
);

/**
 * @swagger
 * /api/client-settings/{clientId}:
 *   delete:
 *     summary: Delete client settings
 *     description: Resets client settings to default values. Only administrators can perform this action.
 *     tags: [Client Settings]
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
 *     responses:
 *       200:
 *         description: Client settings reset successfully
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
 *                         message:
 *                           type: string
 *                           example: "Client settings reset to defaults"
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
 *         description: Client settings not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/client-settings/:clientId",
  auth.adminOnly,
  validateUuidParam,
  asyncHandler(ClientSettingsController.deleteClientSettings),
);

/**
 * @swagger
 * /api/client-settings/{clientId}/validate:
 *   get:
 *     summary: Validate client branding configuration
 *     description: Validates the current branding configuration for a client, checking for any issues with logos, domains, or color schemes.
 *     tags: [Client Settings]
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
 *     responses:
 *       200:
 *         description: Branding configuration validated successfully
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
 *                         isValid:
 *                           type: boolean
 *                           description: Overall validation status
 *                           example: true
 *                         validations:
 *                           type: object
 *                           properties:
 *                             logo:
 *                               type: object
 *                               properties:
 *                                 valid:
 *                                   type: boolean
 *                                   example: true
 *                                 message:
 *                                   type: string
 *                                   example: "Logo URL is accessible and meets size requirements"
 *                             domain:
 *                               type: object
 *                               properties:
 *                                 valid:
 *                                   type: boolean
 *                                   example: true
 *                                 message:
 *                                   type: string
 *                                   example: "Domain configuration is valid"
 *                             colors:
 *                               type: object
 *                               properties:
 *                                 valid:
 *                                   type: boolean
 *                                   example: true
 *                                 message:
 *                                   type: string
 *                                   example: "Color scheme meets contrast requirements"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied - requires admin or client access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Client settings not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/client-settings/:clientId/validate",
  auth.authenticate,
  validateUuidParam,
  asyncHandler(ClientSettingsController.validateBranding),
);

// ============================================================================
// PUBLIC BRANDING ROUTES (No authentication required)
// ============================================================================

/**
 * @swagger
 * /api/public/branding/{slug}:
 *   get:
 *     summary: Get public branding settings by client slug
 *     description: Retrieves public branding information for a client using their unique slug. This endpoint is publicly accessible.
 *     tags: [Client Settings]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Client's unique slug/identifier
 *         example: "acme-logistics"
 *     responses:
 *       200:
 *         description: Branding information retrieved successfully
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
 *                         branding:
 *                           type: object
 *                           properties:
 *                             brandName:
 *                               type: string
 *                               example: "Acme Logistics"
 *                             brandLogo:
 *                               type: string
 *                               format: uri
 *                               example: "https://acme.com/logo.png"
 *                             brandColors:
 *                               type: object
 *                               properties:
 *                                 primary:
 *                                   type: string
 *                                   example: "#007bff"
 *                                 secondary:
 *                                   type: string
 *                                   example: "#6c757d"
 *                             customDomain:
 *                               type: string
 *                               example: "logistics.acme.com"
 *       404:
 *         description: Client branding not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/public/branding/:slug",
  asyncHandler(ClientSettingsController.getPublicBranding),
);

// ============================================================================
// USER INVITATION ROUTES
// ============================================================================

/**
 * @swagger
 * /api/invitations:
 *   post:
 *     summary: Create a new user invitation
 *     description: Creates a new user invitation to join a client. Only admin or operations users can create invitations.
 *     tags: [User Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInvitationRequest'
 *           example:
 *             email: "newuser@acme.com"
 *             role: "operations"
 *             clientId: "CLIENT_001"
 *     responses:
 *       201:
 *         description: User invitation created successfully
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
 *                         invitation:
 *                           $ref: '#/components/schemas/UserInvitation'
 *       400:
 *         description: Validation error or user already exists
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
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User with this email already exists or has pending invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     summary: List user invitations with pagination
 *     description: Retrieves a paginated list of user invitations. Access is filtered by role - operations users only see invitations for their client.
 *     tags: [User Invitations]
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
 *         description: Search term for email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, expired, revoked]
 *         description: Filter by invitation status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, finance, operations, client, support]
 *         description: Filter by invited role
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID (admin/support only)
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
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
 *                             $ref: '#/components/schemas/UserInvitation'
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
router.post(
  "/invitations",
  auth.requireRole(["admin", "operations"]),
  validateCreateUserInvitation,
  asyncHandler(UserInvitationController.createInvitation),
);

router.get(
  "/invitations",
  auth.requireRole(["admin", "support", "operations"]),
  validatePaginationQuery,
  asyncHandler(UserInvitationController.listInvitations),
);

/**
 * @route   GET /api/invitations/:id
 * @desc    Get a specific invitation by ID
 * @access  Private (admin, support, or own client)
 */
router.get(
  "/invitations/:id",
  auth.authenticate,
  validateUuidParam,
  asyncHandler(UserInvitationController.getInvitation),
);

/**
 * @route   PUT /api/invitations/:id
 * @desc    Update invitation status or details
 * @access  Private (admin, operations for own client)
 */
router.put(
  "/invitations/:id",
  auth.requireRole(["admin", "operations"]),
  validateUuidParam,
  asyncHandler(UserInvitationController.updateInvitation),
);

/**
 * @route   POST /api/invitations/:id/cancel
 * @desc    Cancel an invitation
 * @access  Private (admin, operations, or invitation sender)
 */
router.post(
  "/invitations/:id/cancel",
  auth.authenticate,
  validateUuidParam,
  asyncHandler(UserInvitationController.cancelInvitation),
);

/**
 * @route   POST /api/invitations/:id/resend
 * @desc    Resend an invitation (generate new token)
 * @access  Private (admin, operations for own client)
 */
router.post(
  "/invitations/:id/resend",
  auth.requireRole(["admin", "operations"]),
  validateUuidParam,
  asyncHandler(UserInvitationController.resendInvitation),
);

/**
 * @route   GET /api/invitations/stats
 * @desc    Get invitation statistics
 * @access  Private (admin, support)
 */
router.get(
  "/invitations/stats",
  auth.requireRole(["admin", "support"]),
  asyncHandler(UserInvitationController.getInvitationStats),
);

// ============================================================================
// PUBLIC INVITATION ROUTES (No authentication required)
// ============================================================================

/**
 * @route   GET /api/public/invitations/validate/:token
 * @desc    Validate invitation token for acceptance
 * @access  Public
 */
router.get(
  "/public/invitations/validate/:token",
  asyncHandler(UserInvitationController.validateInvitationToken),
);

// ============================================================================
// CLIENT-SPECIFIC USER ROUTES (from users.js but client-scoped)
// ============================================================================

/**
 * @swagger
 * /api/clients/{clientId}/users:
 *   get:
 *     summary: Get all users for a specific client
 *     description: Retrieves a paginated list of users belonging to a specific client. Access is restricted to admin, support, or operations users from the same client.
 *     tags: [Client Users]
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
 *         description: Search term for user name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, finance, operations, client, support]
 *         description: Filter by user role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                             $ref: '#/components/schemas/User'
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/clients/:clientId/users",
  auth.authenticate,
  auth.requireClientAccess(["operations", "admin", "support"]),
  auth.requireOwnClientOrAdmin,
  validatePaginationQuery,
  asyncHandler(ClientController.getClientUsers),
);

/**
 * @swagger
 * /api/clients/{clientId}/invitations:
 *   get:
 *     summary: Get all invitations for a specific client
 *     description: Retrieves a paginated list of user invitations for a specific client. Access is restricted to admin, support, or operations users from the same client.
 *     tags: [Client Users]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, expired, revoked]
 *         description: Filter by invitation status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, finance, operations, client, support]
 *         description: Filter by invited role
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
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
 *                             $ref: '#/components/schemas/UserInvitation'
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/clients/:clientId/invitations",
  auth.authenticate,
  auth.requireClientAccess(["operations", "admin", "support"]),
  auth.requireOwnClientOrAdmin,
  validatePaginationQuery,
  asyncHandler(ClientController.getClientInvitations),
);

/**
 * @swagger
 * /api/clients/{clientId}/stats:
 *   get:
 *     summary: Get detailed statistics for a specific client
 *     description: Retrieves comprehensive statistics and analytics for a specific client. Access is restricted to admin, support, or operations users from the same client.
 *     tags: [Client Users]
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
 *     responses:
 *       200:
 *         description: Client statistics retrieved successfully
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
 *                         userStats:
 *                           type: object
 *                           properties:
 *                             totalUsers:
 *                               type: integer
 *                               example: 50
 *                             activeUsers:
 *                               type: integer
 *                               example: 45
 *                             usersByRole:
 *                               type: object
 *                               example:
 *                                 operations: 5
 *                                 finance: 3
 *                                 client: 42
 *                         invitationStats:
 *                           type: object
 *                           properties:
 *                             totalInvitations:
 *                               type: integer
 *                               example: 60
 *                             pendingInvitations:
 *                               type: integer
 *                               example: 5
 *                             acceptanceRate:
 *                               type: number
 *                               example: 85.5
 *                         activityStats:
 *                           type: object
 *                           properties:
 *                             lastLoginDate:
 *                               type: string
 *                               format: date-time
 *                               example: "2024-01-15T10:30:00Z"
 *                             activeThisMonth:
 *                               type: integer
 *                               example: 40
 *                             averageSessionDuration:
 *                               type: number
 *                               example: 45.5
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/clients/:clientId/stats",
  auth.authenticate,
  auth.requireClientAccess(["operations", "admin", "support"]),
  auth.requireOwnClientOrAdmin,
  validateUuidParam,
  asyncHandler(ClientController.getClientDetailedStats),
);

module.exports = router;
