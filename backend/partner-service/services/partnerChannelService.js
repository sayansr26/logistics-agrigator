/**
 * Partner Channel Service
 *
 * Purpose: Manage single/multi-channel API configurations for partners
 * Following auth-service patterns with Prisma ORM and audit logging
 *
 * Features:
 * - Get active channel for API calls
 * - List all channels for a partner
 * - Create/update/delete channel configurations
 * - Switch between SINGLE and MULTI channel modes
 * - Automatic migration of existing configurations
 * - Comprehensive audit logging
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");

class PartnerChannelService {
  constructor() {
    this.serviceName = "PartnerChannelService";
  }

  // ==========================================
  // CHANNEL RETRIEVAL OPERATIONS
  // ==========================================

  /**
   * Get active channel for API calls
   * For SINGLE mode: returns legacy config from Partner model
   * For MULTI mode: returns primary active channel or highest priority active channel
   * @param {string} partnerId - Partner UUID/CUID
   * @returns {Promise<Object|null>} Active channel configuration
   */
  async getActiveChannel(partnerId) {
    try {
      logger.info("Getting active channel", { partnerId });

      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { channelMode: true, name: true },
      });

      if (!partner) {
        logger.warn("Partner not found", { partnerId });
        throw new Error("Partner not found");
      }

      // For SINGLE mode, return the legacy config
      if (partner.channelMode === "SINGLE") {
        // If channel configs exist, prefer them even in SINGLE mode (single configured channel).
        // Legacy partner.apiUrl/apiToken is used only when no channel configs are present.
        const primaryChannel = await prisma.partnerChannelConfig.findFirst({
          where: {
            partnerId,
            isActive: true,
            isPrimary: true,
          },
          orderBy: { priority: "asc" },
        });

        if (primaryChannel) {
          return {
            ...primaryChannel,
            mode: "SINGLE",
          };
        }

        const fallbackChannel = await prisma.partnerChannelConfig.findFirst({
          where: {
            partnerId,
            isActive: true,
          },
          orderBy: { priority: "asc" },
        });

        if (fallbackChannel) {
          return {
            ...fallbackChannel,
            mode: "SINGLE",
          };
        }

        const legacyData = await prisma.partner.findUnique({
          where: { id: partnerId },
          select: { apiUrl: true, apiToken: true, apiVersion: true },
        });

        return {
          channelName: "default",
          mode: "SINGLE",
          apiUrl: legacyData.apiUrl,
          apiKey: legacyData.apiToken,
          apiVersion: legacyData.apiVersion,
          aggregatorType: "NONE",
          aggregatorConfig: null,
        };
      }

      // For MULTI mode, get the primary active channel
      const primaryChannel = await prisma.partnerChannelConfig.findFirst({
        where: {
          partnerId,
          isActive: true,
          isPrimary: true,
        },
        orderBy: { priority: "asc" },
      });

      if (primaryChannel) {
        return {
          ...primaryChannel,
          mode: "MULTI",
        };
      }

      // Fallback to highest priority active channel
      const fallbackChannel = await prisma.partnerChannelConfig.findFirst({
        where: {
          partnerId,
          isActive: true,
        },
        orderBy: { priority: "asc" },
      });

      if (fallbackChannel) {
        return {
          ...fallbackChannel,
          mode: "MULTI",
        };
      }

      logger.warn("No active channel found for partner", { partnerId });
      return null;
    } catch (error) {
      logger.error("Error getting active channel", {
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List all channels for a partner
   * @param {string} partnerId - Partner UUID/CUID
   * @returns {Promise<Array>} List of channel configurations
   */
  async listChannels(partnerId) {
    try {
      logger.info("Listing channels", { partnerId });

      const channels = await prisma.partnerChannelConfig.findMany({
        where: { partnerId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      });

      logger.info("Channels retrieved", { partnerId, count: channels.length });
      return channels;
    } catch (error) {
      logger.error("Error listing channels", {
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==========================================
  // CHANNEL MANAGEMENT OPERATIONS
  // ==========================================

  /**
   * Create channel(s) for a partner
   * @param {Object} data - Channel creation data
   * @param {string} data.partnerId - Partner UUID/CUID
   * @param {Array} data.channels - Array of channel configurations
   * @param {string} [data.userId] - User ID for audit logging
   * @returns {Promise<Array>} Created channels
   */
  async createChannels(data) {
    const { partnerId, channels, userId } = data;

    try {
      logger.info("Creating channels", {
        partnerId,
        channelCount: channels.length,
      });

      // Verify partner exists
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { name: true, channelMode: true },
      });

      if (!partner) {
        throw new Error("Partner not found");
      }

      const results = [];

      for (const channel of channels) {
        // Check for duplicate channel name
        const existing = await prisma.partnerChannelConfig.findFirst({
          where: {
            partnerId,
            channelName: channel.channelName,
          },
        });

        if (existing) {
          throw new Error(
            `Channel with name "${channel.channelName}" already exists`,
          );
        }

        const newChannel = await prisma.partnerChannelConfig.create({
          data: {
            partnerId,
            channelName: channel.channelName,
            apiUrl: channel.apiUrl,
            apiKey: channel.apiKey,
            isActive: channel.isActive ?? true,
            isPrimary: channel.isPrimary ?? false,
            priority: channel.priority ?? 1,
            aggregatorType: channel.aggregatorType ?? "NONE",
            aggregatorConfig: channel.aggregatorConfig ?? undefined,
            webhookSecret: channel.webhookSecret ?? undefined,
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            resourceType: "PARTNER_CHANNEL",
            resourceId: newChannel.id,
            userId,
            requestData: { partnerId, channel },
            ipAddress: null,
            userAgent: null,
          },
        });

        results.push(newChannel);
      }

      logger.info("Channels created successfully", {
        partnerId,
        createdCount: results.length,
      });

      await this._syncChannelMode(partnerId);

      return results;
    } catch (error) {
      logger.error("Error creating channels", {
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update a channel
   * @param {Object} data - Update data
   * @param {string} data.channelId - Channel UUID
   * @param {Object} data.updates - Fields to update
   * @param {string} [data.userId] - User ID for audit logging
   * @returns {Promise<Object>} Updated channel
   */
  async updateChannel(data) {
    const { channelId, updates, userId } = data;

    try {
      logger.info("Updating channel", { channelId, updates });

      // If updating channel name, check for duplicates
      if (updates.channelName) {
        const existing = await prisma.partnerChannelConfig.findFirst({
          where: {
            id: { not: channelId },
            channelName: updates.channelName,
          },
        });

        if (existing) {
          throw new Error(
            `Channel with name "${updates.channelName}" already exists`,
          );
        }
      }

      const channel = await prisma.partnerChannelConfig.update({
        where: { id: channelId },
        data: updates,
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          resourceType: "PARTNER_CHANNEL",
          resourceId: channelId,
          userId,
          requestData: updates,
          ipAddress: null,
          userAgent: null,
        },
      });

      logger.info("Channel updated successfully", { channelId });
      return channel;
    } catch (error) {
      logger.error("Error updating channel", {
        channelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a channel
   * @param {string} channelId - Channel UUID
   * @param {string} [userId] - User ID for audit logging
   * @returns {Promise<Object>} Deletion result
   */
  async deleteChannel(channelId, userId) {
    try {
      logger.info("Deleting channel", { channelId });

      // Get partnerId before deletion for mode sync
      const channelToDelete = await prisma.partnerChannelConfig.findUnique({
        where: { id: channelId },
        select: { partnerId: true },
      });

      await prisma.partnerChannelConfig.delete({
        where: { id: channelId },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "DELETE",
          resourceType: "PARTNER_CHANNEL",
          resourceId: channelId,
          userId,
          ipAddress: null,
          userAgent: null,
        },
      });

      logger.info("Channel deleted successfully", { channelId });

      if (channelToDelete) {
        await this._syncChannelMode(channelToDelete.partnerId);
      }

      return { success: true };
    } catch (error) {
      logger.error("Error deleting channel", {
        channelId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==========================================
  // CREDENTIAL TESTING
  // ==========================================

  /**
   * Test unsaved credential data against the live courier API so users can
   * verify credentials BEFORE saving. No DB writes; single attempt (no retry
   * backoff) so the result comes back quickly.
   * @param {Object} channelData - { aggregatorType, apiUrl?, apiKey?, aggregatorConfig? }
   * @returns {Promise<{success: boolean, message: string, aggregatorType: string}>}
   */
  async testChannelCredentials(channelData) {
    const { createAdapter } = require("../adapters/AdapterFactory");

    const adapter = createAdapter({
      aggregatorType: channelData.aggregatorType,
      apiUrl: channelData.apiUrl || "",
      apiKey: channelData.apiKey || "",
      aggregatorConfig: channelData.aggregatorConfig || {},
      channelName: channelData.channelName || "credential-test",
    });

    if (!adapter) {
      return {
        success: false,
        message: "No adapter available for this aggregator type",
        aggregatorType: channelData.aggregatorType,
      };
    }

    // Fast-fail for interactive testing: one attempt, shorter timeout
    adapter.maxRetryAttempts = 1;
    adapter.client.defaults.timeout = 10000;

    try {
      const result = await adapter.testConnection();
      logger.info("Channel credential test completed", {
        aggregatorType: channelData.aggregatorType,
        success: result.success,
      });
      return { ...result, aggregatorType: channelData.aggregatorType };
    } catch (error) {
      logger.warn("Channel credential test failed", {
        aggregatorType: channelData.aggregatorType,
        error: error.message,
      });
      return {
        success: false,
        message: error.message || "Credential test failed",
        aggregatorType: channelData.aggregatorType,
      };
    }
  }

  // ==========================================
  // CHANNEL MODE AUTO-SYNC
  // ==========================================

  /**
   * Auto-sync channelMode based on channel count
   * @param {string} partnerId - Partner CUID
   */
  async _syncChannelMode(partnerId) {
    const count = await prisma.partnerChannelConfig.count({
      where: { partnerId },
    });
    const mode = count <= 1 ? "SINGLE" : "MULTI";
    await prisma.partner.update({
      where: { id: partnerId },
      data: { channelMode: mode },
    });
  }
}

module.exports = new PartnerChannelService();
