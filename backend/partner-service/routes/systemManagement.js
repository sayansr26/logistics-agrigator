const express = require("express");
const systemManagementController = require("../controllers/systemManagementController");
const authMiddleware = require("../middleware/auth");
const { systemManagementLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemInitialization:
 *       type: object
 *       properties:
 *         systemHealth:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               enum: [healthy, degraded, unhealthy]
 *               example: healthy
 *             components:
 *               type: object
 *         services:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: partner-service
 *               status:
 *                 type: string
 *                 example: running
 *               port:
 *                 type: integer
 *                 example: 3005
 *         configuration:
 *           type: object
 *           properties:
 *             environment:
 *               type: string
 *               example: development
 *             version:
 *               type: string
 *               example: 1.0.0
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     RateLimitConfig:
 *       type: object
 *       properties:
 *         currentLimits:
 *           type: object
 *           properties:
 *             general:
 *               type: string
 *               example: "200 requests/15min"
 *             partnerManagement:
 *               type: string
 *               example: "20 requests/15min"
 *         statistics:
 *           type: object
 *           properties:
 *             totalEndpoints:
 *               type: integer
 *               example: 50
 *             activeRequests:
 *               type: integer
 *               example: 25
 *             blockedRequests:
 *               type: integer
 *               example: 0
 *         recommendations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: optimization
 *               priority:
 *                 type: string
 *                 example: medium
 *               message:
 *                 type: string
 *               action:
 *                 type: string
 *
 *     CacheManagement:
 *       type: object
 *       properties:
 *         cacheStatistics:
 *           type: object
 *           properties:
 *             memoryUsage:
 *               type: object
 *               properties:
 *                 used:
 *                   type: string
 *                   example: "25MB"
 *                 peak:
 *                   type: string
 *                   example: "45MB"
 *             keyCount:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 1000
 *                 expires:
 *                   type: integer
 *                   example: 500
 *             hitRate:
 *               type: string
 *               example: "85%"
 *         memoryUsage:
 *           type: object
 *           properties:
 *             used:
 *               type: string
 *               example: "25MB"
 *             limit:
 *               type: string
 *               example: "100MB"
 *             percentage:
 *               type: string
 *               example: "25%"
 *         performance:
 *           type: object
 *           properties:
 *             averageResponseTime:
 *               type: string
 *               example: "2ms"
 *             throughput:
 *               type: string
 *               example: "1000 ops/sec"
 *             errorRate:
 *               type: string
 *               example: "0.1%"
 *
 *     AuditTrail:
 *       type: object
 *       properties:
 *         entries:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "audit_123"
 *               userId:
 *                 type: string
 *                 example: "user_456"
 *               action:
 *                 type: string
 *                 example: "CREATE"
 *               resource:
 *                 type: string
 *                 example: "Partner"
 *               resourceId:
 *                 type: string
 *                 example: "partner_789"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               ipAddress:
 *                 type: string
 *                 example: "192.168.1.1"
 *         summary:
 *           type: object
 *           properties:
 *             totalEntries:
 *               type: integer
 *               example: 150
 *             uniqueUsers:
 *               type: integer
 *               example: 25
 *             actions:
 *               type: object
 *               properties:
 *                 CREATE:
 *                   type: integer
 *                   example: 50
 *                 UPDATE:
 *                   type: integer
 *                   example: 75
 *                 DELETE:
 *                   type: integer
 *                   example: 25
 *         insights:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: activity
 *               message:
 *                 type: string
 *               trend:
 *                 type: string
 *                 example: normal
 *
 *     WebhookManagement:
 *       type: object
 *       properties:
 *         webhooks:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "webhook_123"
 *               url:
 *                 type: string
 *                 example: "https://api.example.com/webhook"
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["partner.created", "shipment.updated"]
 *               status:
 *                 type: string
 *                 enum: [active, inactive, failed]
 *                 example: active
 *         statistics:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 5
 *             active:
 *               type: integer
 *               example: 4
 *             failed:
 *               type: integer
 *               example: 1
 *             successRate:
 *               type: string
 *               example: "95%"
 *         health:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               example: healthy
 *             endpoints:
 *               type: integer
 *               example: 5
 *             failureRate:
 *               type: string
 *               example: "5%"
 */

/**
 * @swagger
 * /api/v1/main-system:
 *   post:
 *     summary: Initialize main system
 *     description: Initialize the main system with configuration and health checks
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Force initialization even if system is already initialized
 *                 example: false
 *               config:
 *                 type: object
 *                 description: System configuration parameters
 *                 properties:
 *                   environment:
 *                     type: string
 *                     example: development
 *                   features:
 *                     type: object
 *                     properties:
 *                       caching:
 *                         type: boolean
 *                         example: true
 *                       monitoring:
 *                         type: boolean
 *                         example: true
 *     responses:
 *       200:
 *         description: Main system initialized successfully
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
 *                     system:
 *                       $ref: '#/components/schemas/SystemInitialization'
 *                 message:
 *                   type: string
 *                   example: Main system initialized successfully
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post(
  "/main-system",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.initializeMainSystem,
);

/**
 * @swagger
 * /api/v1/main-system-rate-limit:
 *   post:
 *     summary: Manage rate limiting
 *     description: Configure and manage rate limiting settings for the system
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [update, reset, configure]
 *                 description: Rate limit operation to perform
 *                 example: update
 *               limits:
 *                 type: object
 *                 description: Rate limit configurations
 *                 properties:
 *                   general:
 *                     type: string
 *                     example: "300 requests/15min"
 *                   partnerManagement:
 *                     type: string
 *                     example: "30 requests/15min"
 *               skipCache:
 *                 type: boolean
 *                 description: Skip cache for fresh data
 *                 example: false
 *     responses:
 *       200:
 *         description: Rate limit management completed successfully
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
 *                     rateLimit:
 *                       $ref: '#/components/schemas/RateLimitConfig'
 *                 message:
 *                   type: string
 *                   example: Rate limit management completed successfully
 *       400:
 *         description: Invalid rate limit configuration
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get rate limit status
 *     description: Retrieve current rate limiting status and statistics
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeStatistics
 *         schema:
 *           type: boolean
 *         description: Include detailed statistics
 *         example: true
 *       - in: query
 *         name: endpoint
 *         schema:
 *           type: string
 *         description: Filter by specific endpoint
 *         example: "/api/v1/partners"
 *     responses:
 *       200:
 *         description: Rate limit status retrieved successfully
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
 *                     rateLimit:
 *                       $ref: '#/components/schemas/RateLimitConfig'
 *                 message:
 *                   type: string
 *                   example: Rate limit status retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/main-system-rate-limit",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.manageRateLimit,
);

router.get(
  "/main-system-rate-limit",
  authMiddleware.authenticate,
  systemManagementLimiter,
  systemManagementController.getRateLimitStatus,
);

/**
 * @swagger
 * /api/v1/main-system-cache:
 *   post:
 *     summary: Manage cache system
 *     description: Perform cache management operations including clearing, optimization, and configuration
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [clear, optimize, configure, analyze]
 *                 description: Cache operation to perform
 *                 example: clear
 *               target:
 *                 type: string
 *                 description: Cache target (all, specific_key, pattern)
 *                 example: "partner_*"
 *               options:
 *                 type: object
 *                 description: Operation-specific options
 *                 properties:
 *                   force:
 *                     type: boolean
 *                     example: false
 *                   preserveImportant:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Cache management completed successfully
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
 *                     cache:
 *                       $ref: '#/components/schemas/CacheManagement'
 *                 message:
 *                   type: string
 *                   example: Cache management completed successfully
 *       400:
 *         description: Invalid cache operation
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get cache status
 *     description: Retrieve current cache status, statistics, and performance metrics
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeKeys
 *         schema:
 *           type: boolean
 *         description: Include cache keys information
 *         example: false
 *       - in: query
 *         name: pattern
 *         schema:
 *           type: string
 *         description: Filter cache keys by pattern
 *         example: "partner_*"
 *     responses:
 *       200:
 *         description: Cache status retrieved successfully
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
 *                     cache:
 *                       $ref: '#/components/schemas/CacheManagement'
 *                 message:
 *                   type: string
 *                   example: Cache status retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/main-system-cache",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.manageCache,
);

router.get(
  "/main-system-cache",
  authMiddleware.authenticate,
  systemManagementLimiter,
  systemManagementController.getCacheStatus,
);

/**
 * @swagger
 * /api/v1/audit:
 *   get:
 *     summary: Get audit trail
 *     description: Retrieve system audit trail with filtering and analysis capabilities
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *         example: "user_123"
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *         example: "CREATE"
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *         example: "Partner"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter to end date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of entries to return
 *         example: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of entries to skip
 *         example: 0
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *     responses:
 *       200:
 *         description: Audit trail retrieved successfully
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
 *                     audit:
 *                       $ref: '#/components/schemas/AuditTrail'
 *                 message:
 *                   type: string
 *                   example: Audit trail retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get(
  "/audit",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.getAuditTrail,
);

/**
 * @swagger
 * /api/v1/webhooks:
 *   post:
 *     summary: Manage webhooks
 *     description: Create, update, or configure webhook endpoints for system events
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [create, update, delete, test]
 *                 description: Webhook operation to perform
 *                 example: create
 *               webhook:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Webhook ID (required for update/delete)
 *                     example: "webhook_123"
 *                   url:
 *                     type: string
 *                     description: Webhook endpoint URL
 *                     example: "https://api.example.com/webhook"
 *                   events:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Events to subscribe to
 *                     example: ["partner.created", "shipment.updated"]
 *                   secret:
 *                     type: string
 *                     description: Webhook secret for signature verification
 *                     example: "webhook_secret_key"
 *                   active:
 *                     type: boolean
 *                     description: Whether webhook is active
 *                     example: true
 *     responses:
 *       200:
 *         description: Webhook management completed successfully
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
 *                     webhooks:
 *                       $ref: '#/components/schemas/WebhookManagement'
 *                 message:
 *                   type: string
 *                   example: Webhook management completed successfully
 *       400:
 *         description: Invalid webhook configuration
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 *   get:
 *     summary: Get webhooks list
 *     description: Retrieve list of configured webhooks with statistics and health information
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, failed]
 *         description: Filter by webhook status
 *         example: active
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *         description: Filter by event type
 *         example: "partner.created"
 *       - in: query
 *         name: includeStatistics
 *         schema:
 *           type: boolean
 *         description: Include webhook statistics
 *         example: true
 *       - in: query
 *         name: skipCache
 *         schema:
 *           type: boolean
 *         description: Skip cache and fetch fresh data
 *         example: false
 *     responses:
 *       200:
 *         description: Webhooks retrieved successfully
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
 *                     webhooks:
 *                       $ref: '#/components/schemas/WebhookManagement'
 *                 message:
 *                   type: string
 *                   example: Webhooks retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.post(
  "/webhooks",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.manageWebhooks,
);

router.get(
  "/webhooks",
  authMiddleware.authenticate,
  systemManagementLimiter,
  systemManagementController.getWebhooks,
);

/**
 * @swagger
 * /api/v1/system-health:
 *   get:
 *     summary: Get system health
 *     description: Retrieve comprehensive system health status including all components
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health retrieved successfully
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
 *                     health:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                           example: healthy
 *                         components:
 *                           type: object
 *                           properties:
 *                             database:
 *                               type: string
 *                               example: healthy
 *                             redis:
 *                               type: string
 *                               example: healthy
 *                             externalAPI:
 *                               type: string
 *                               example: healthy
 *                             services:
 *                               type: string
 *                               example: healthy
 *                         uptime:
 *                           type: number
 *                           example: 86400
 *                         memory:
 *                           type: object
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                 message:
 *                   type: string
 *                   example: System health retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/system-health",
  authMiddleware.authenticate,
  systemManagementController.getSystemHealth,
);

/**
 * @swagger
 * /api/v1/services-status:
 *   get:
 *     summary: Get services status
 *     description: Retrieve status information for all system services
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Services status retrieved successfully
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
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: partner-service
 *                           status:
 *                             type: string
 *                             example: running
 *                           port:
 *                             type: integer
 *                             example: 3005
 *                           uptime:
 *                             type: number
 *                             example: 86400
 *                 message:
 *                   type: string
 *                   example: Services status retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/services-status",
  authMiddleware.authenticate,
  systemManagementController.getServicesStatus,
);

/**
 * @swagger
 * /api/v1/system-configuration:
 *   get:
 *     summary: Get system configuration
 *     description: Retrieve current system configuration settings
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System configuration retrieved successfully
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
 *                     configuration:
 *                       type: object
 *                       properties:
 *                         environment:
 *                           type: string
 *                           example: development
 *                         version:
 *                           type: string
 *                           example: 1.0.0
 *                         features:
 *                           type: object
 *                         limits:
 *                           type: object
 *                 message:
 *                   type: string
 *                   example: System configuration retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 *   put:
 *     summary: Update system configuration
 *     description: Update system configuration settings (admin only)
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               features:
 *                 type: object
 *                 properties:
 *                   caching:
 *                     type: boolean
 *                     example: true
 *                   monitoring:
 *                     type: boolean
 *                     example: true
 *               limits:
 *                 type: object
 *                 properties:
 *                   maxRequestsPerMinute:
 *                     type: integer
 *                     example: 1200
 *     responses:
 *       200:
 *         description: System configuration updated successfully
 *       400:
 *         description: Invalid configuration parameters
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get(
  "/system-configuration",
  authMiddleware.authenticate,
  systemManagementController.getSystemConfiguration,
);

router.put(
  "/system-configuration",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.updateSystemConfiguration,
);

/**
 * @swagger
 * /api/v1/system-cache/{type}:
 *   delete:
 *     summary: Clear system cache
 *     description: Clear system cache by type or clear all cache
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *         description: Cache type to clear (optional - if not provided, clears all cache)
 *         example: "performance"
 *     responses:
 *       200:
 *         description: System cache cleared successfully
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
 *                     cleared:
 *                       type: boolean
 *                       example: true
 *                     type:
 *                       type: string
 *                       example: "performance"
 *                 message:
 *                   type: string
 *                   example: System cache cleared successfully
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/system-cache/:type?",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementController.clearSystemCache,
);

/**
 * @swagger
 * /api/v1/system-statistics:
 *   get:
 *     summary: Get system statistics
 *     description: Retrieve comprehensive system statistics and performance metrics
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *         description: Include detailed statistics
 *         example: true
 *     responses:
 *       200:
 *         description: System statistics retrieved successfully
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
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         uptime:
 *                           type: number
 *                           example: 86400
 *                         memory:
 *                           type: object
 *                         requests:
 *                           type: object
 *                         cache:
 *                           type: object
 *                         database:
 *                           type: object
 *                         external:
 *                           type: object
 *                 message:
 *                   type: string
 *                   example: System statistics retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/system-statistics",
  authMiddleware.authenticate,
  systemManagementController.getSystemStatistics,
);

/**
 * @swagger
 * /api/v1/system-maintenance:
 *   post:
 *     summary: Execute system maintenance
 *     description: Execute various system maintenance operations
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - maintenanceType
 *             properties:
 *               maintenanceType:
 *                 type: string
 *                 enum: [cache_cleanup, log_rotation, health_check, optimization]
 *                 description: Type of maintenance to perform
 *                 example: cache_cleanup
 *               options:
 *                 type: object
 *                 description: Maintenance-specific options
 *                 properties:
 *                   force:
 *                     type: boolean
 *                     example: false
 *                   dryRun:
 *                     type: boolean
 *                     example: false
 *     responses:
 *       200:
 *         description: System maintenance executed successfully
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
 *                     maintenance:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: cache_cleanup
 *                         startedAt:
 *                           type: string
 *                           format: date-time
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         operations:
 *                           type: array
 *                           items:
 *                             type: string
 *                         status:
 *                           type: string
 *                           example: completed
 *                 message:
 *                   type: string
 *                   example: System maintenance executed successfully
 *       400:
 *         description: Invalid maintenance type
 *       401:
 *         description: Unauthorized access
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post(
  "/system-maintenance",
  authMiddleware.authenticate,
  authMiddleware.adminOnly,
  systemManagementLimiter,
  systemManagementController.executeSystemMaintenance,
);

/**
 * @swagger
 * /api/v1/system-alerts:
 *   get:
 *     summary: Get system alerts
 *     description: Retrieve current system alerts and notifications
 *     tags: [System Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, warning, info]
 *         description: Filter by alert severity
 *         example: warning
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by alert category
 *         example: performance
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of alerts to return
 *         example: 50
 *     responses:
 *       200:
 *         description: System alerts retrieved successfully
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
 *                     alerts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 5
 *                         critical:
 *                           type: integer
 *                           example: 0
 *                         warning:
 *                           type: integer
 *                           example: 2
 *                         info:
 *                           type: integer
 *                           example: 3
 *                         alerts:
 *                           type: array
 *                           items:
 *                             type: object
 *                         summary:
 *                           type: object
 *                 message:
 *                   type: string
 *                   example: System alerts retrieved successfully
 *       401:
 *         description: Unauthorized access
 *       500:
 *         description: Internal server error
 */
router.get(
  "/system-alerts",
  authMiddleware.authenticate,
  systemManagementController.getSystemAlerts,
);

module.exports = router;
