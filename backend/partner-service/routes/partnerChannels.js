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
const { partnerManagementLimiter } = require("../middleware/rateLimiter");
const {
  createChannelSchema,
  updateChannelSchema,
} = require("../validation/partnerChannelSchemas");

// Apply authentication to all channel routes
router.use(authMiddleware.authenticate);

// Authorization: Admin + Operations roles only
router.use(authMiddleware.requireRole(["superadmin", "admin", "operations"]));

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
  partnerChannelController.getActiveChannel,
);

/**
 * @route   GET /api/v1/partners/:partnerId/channels
 * @desc    List all channels for a partner
 * @access  Private (Admin, Operations)
 */
router.get(
  "/partners/:partnerId/channels",
  partnerChannelController.listChannels,
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
  partnerManagementLimiter,
  partnerChannelController.deleteChannel,
);

module.exports = router;
