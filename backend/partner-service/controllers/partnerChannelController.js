/**
 * Partner Channel Controller
 *
 * Purpose: Handle HTTP requests for partner channel management
 * Following auth-service patterns with controller pattern
 *
 * All business logic is delegated to the service layer
 * This controller only handles HTTP request/response concerns
 */

const partnerChannelService = require("../services/partnerChannelService");
const logger = require("../shared/lib/logger");

class PartnerChannelController {
  /**
   * Get active channel for a partner
   * Used by other services to determine which API endpoint to use
   */
  async getActiveChannel(req, res) {
    try {
      const { partnerId } = req.params;

      logger.info("Get active channel request", { partnerId });

      const channel = await partnerChannelService.getActiveChannel(partnerId);

      if (!channel) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "NOT_FOUND",
            message: "No active channel found for this partner",
          },
        });
      }

      res.status(200).json({
        status: "success",
        data: channel,
      });
    } catch (error) {
      logger.error("Error in getActiveChannel controller", {
        error: error.message,
      });
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * List all channels for a partner
   */
  async listChannels(req, res) {
    try {
      const { partnerId } = req.params;

      logger.info("List channels request", { partnerId });

      const channels = await partnerChannelService.listChannels(partnerId);

      res.status(200).json({
        status: "success",
        data: {
          channels,
          total: channels.length,
        },
      });
    } catch (error) {
      logger.error("Error in listChannels controller", {
        error: error.message,
      });
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Create channels for a partner
   * Supports bulk creation of multiple channels
   */
  async createChannels(req, res) {
    try {
      const { partnerId } = req.params;
      const { channels } = req.body;
      const userId = req.user?.id;

      logger.info("Create channels request", {
        partnerId,
        channelCount: channels?.length,
      });

      const results = await partnerChannelService.createChannels({
        partnerId,
        channels,
        userId,
      });

      res.status(201).json({
        status: "success",
        data: {
          channels: results,
          total: results.length,
        },
        meta: {
          message: `Successfully created ${results.length} channel(s)`,
        },
      });
    } catch (error) {
      logger.error("Error in createChannels controller", {
        error: error.message,
      });

      // Handle specific error cases
      const statusCode = error.message.includes("not found")
        ? 404
        : error.message.includes("already exists")
          ? 409
          : 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: statusCode === 409 ? "CONFLICT" : "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Update a channel
   */
  async updateChannel(req, res) {
    try {
      const { channelId } = req.params;
      const updates = req.body;
      const userId = req.user?.id;

      logger.info("Update channel request", { channelId, updates });

      const channel = await partnerChannelService.updateChannel({
        channelId,
        updates,
        userId,
      });

      res.status(200).json({
        status: "success",
        data: channel,
      });
    } catch (error) {
      logger.error("Error in updateChannel controller", {
        error: error.message,
      });

      // Handle specific error cases
      const statusCode =
        error.message.includes("not found") ||
        error.message.includes("Record to update not found")
          ? 404
          : error.message.includes("already exists")
            ? 409
            : 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: statusCode === 409 ? "CONFLICT" : "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Delete a channel
   */
  async deleteChannel(req, res) {
    try {
      const { channelId } = req.params;
      const userId = req.user?.id;

      logger.info("Delete channel request", { channelId });

      await partnerChannelService.deleteChannel(channelId, userId);

      res.status(200).json({
        status: "success",
        data: {
          message: "Channel deleted successfully",
        },
      });
    } catch (error) {
      logger.error("Error in deleteChannel controller", {
        error: error.message,
      });

      const statusCode =
        error.message.includes("not found") ||
        error.message.includes("Record to delete does not exist")
          ? 404
          : 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }
}

module.exports = new PartnerChannelController();
