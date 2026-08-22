/**
 * Partner Channel Management Routes
 *
 * API routes for managing single/multi-channel API configurations for partners:
 * - Get active channel for API calls
 * - List all channels for a partner
 * - Create/update/delete channel configurations
 * - Switch between SINGLE and MULTI channel modes
 *
 * Authentication: Required (JWT)
 * Authorization: Admin + Operations roles only
 * Rate Limiting: Applied to prevent abuse
 */

const express = require("express");
const router = express.Router();
const partnerChannelController = require("../controllers/partnerChannelController");
const { validate } = require("../middleware/validate");
const { authMiddleware } = require("../shared/lib/auth");
const {
  partnerManagementLimiter,
  serviceabilityLimiter,
} = require("../middleware/rateLimiter");
const {
  createChannelSchema,
  updateChannelSchema,
  testChannelSchema,
} = require("../validation/partnerChannelSchemas");

// Authentication + authorization for every route in this router.
// NOTE: these MUST be attached per-route, not via a pathless router.use().
// This router is mounted at the bare "/api/v1" prefix, so a pathless
// router.use() would run for every /api/v1/* request in the service —
// including routes mounted afterwards (charge-definitions, charge-configs,
// ...) — and reject them with 403 for any role outside this list.
const channelGuards = [
  authMiddleware.authenticate,
  authMiddleware.requireRole(["superadmin", "admin", "operations"]),
];

// NOTE: partnerManagementLimiter (max 20 / 15min) is applied ONLY to the
// mutation routes below — NOT router-wide — so channel GET/list reads (which
// happen on every partner-detail page load) are not throttled by the strict
// write limiter and don't trip "Too many partner management operations".

// ==========================================
// CHANNEL RETRIEVAL ROUTES
// ==========================================

/**
 * @route   GET /api/v1/partners/:partnerId/channels/active
 * @desc    Get active channel for a partner (used by other services)
 * @access  Private (Admin, Operations)
 */
router.get(
  "/partners/:partnerId/channels/active",
  ...channelGuards,
  partnerChannelController.getActiveChannel,
);

/**
 * @route   GET /api/v1/partners/:partnerId/channels
 * @desc    List all channels for a partner
 * @access  Private (Admin, Operations)
 */
router.get(
  "/partners/:partnerId/channels",
  ...channelGuards,
  partnerChannelController.listChannels,
);

/**
 * @route   POST /api/v1/channels/test
 * @desc    Test unsaved channel credentials against the live courier API
 *          (no DB writes). Uses the lighter serviceability limiter so users
 *          can retry tests without exhausting the mutation quota.
 * @access  Private (Admin, Operations)
 * @body    { aggregatorType, apiUrl?, apiKey?, aggregatorConfig? }
 */
router.post(
  "/channels/test",
  ...channelGuards,
  serviceabilityLimiter,
  validate(testChannelSchema, "body"),
  partnerChannelController.testChannel,
);

// ==========================================
// CHANNEL MANAGEMENT ROUTES
// ==========================================

/**
 * @route   POST /api/v1/partners/:partnerId/channels
 * @desc    Create channel(s) for a partner
 * @access  Private (Admin, Operations)
 * @body    {
 *           channels: [{
 *             channelName: string,
 *             apiUrl: string,
 *             apiKey?: string,
 *             isActive?: boolean,
 *             isPrimary?: boolean,
 *             priority?: number
 *           }]
 *         }
 */
router.post(
  "/partners/:partnerId/channels",
  ...channelGuards,
  partnerManagementLimiter,
  validate(createChannelSchema, "body"),
  partnerChannelController.createChannels,
);

/**
 * @route   PUT /api/v1/channels/:channelId
 * @desc    Update a channel
 * @access  Private (Admin, Operations)
 * @body    Partial channel configuration
 */
router.put(
  "/channels/:channelId",
  ...channelGuards,
  partnerManagementLimiter,
  validate(updateChannelSchema, "body"),
  partnerChannelController.updateChannel,
);

/**
 * @route   DELETE /api/v1/channels/:channelId
 * @desc    Delete a channel
 * @access  Private (Admin, Operations)
 */
router.delete(
  "/channels/:channelId",
  ...channelGuards,
  partnerManagementLimiter,
  partnerChannelController.deleteChannel,
);

module.exports = router;
