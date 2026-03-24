/**
 * Courier Operation Service
 *
 * Purpose: Orchestrate courier operations (book, cancel, track, pickup, label, manifest, serviceability)
 * through partner channel adapters.
 *
 * Delegates API calls to the appropriate aggregator adapter based on the partner's active channel.
 * All operations include audit logging for CRUD actions.
 */

const partnerChannelService = require("./partnerChannelService");
const {
  createAdapter,
  getSupportedAggregators,
} = require("../adapters/AdapterFactory");
const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");

function normalizeIndianPhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return raw;
  return raw.startsWith("+91") ? raw.slice(3) : raw;
}

class CourierOperationService {
  constructor() {
    this.serviceName = "CourierOperationService";
  }

  /**
   * Get active channel and validate it has an aggregator configured
   * @param {string} partnerId
   * @returns {Promise<Object>} Active channel configuration
   * @private
   */
  async _getValidatedChannel(partnerId) {
    const channel = await partnerChannelService.getActiveChannel(partnerId);

    if (!channel) {
      throw Object.assign(
        new Error(`No active channel found for partner ${partnerId}`),
        { code: "CHANNEL_NOT_FOUND", statusCode: 404 },
      );
    }

    if (channel.aggregatorType === "NONE") {
      throw Object.assign(
        new Error(
          `Partner ${partnerId} does not have an aggregator configured`,
        ),
        { code: "NO_AGGREGATOR", statusCode: 400 },
      );
    }

    return channel;
  }

  /**
   * Book a shipment with the courier partner
   * @param {string} partnerId - Partner ID
   * @param {Object} shipmentData - Shipment booking details
   * @param {string} [userId] - User ID for audit logging
   * @returns {Promise<Object>} Booking result with AWB number
   */
  async bookShipment(partnerId, shipmentData, userId) {
    try {
      logger.info("Booking shipment", {
        partnerId,
        orderId: shipmentData.orderId,
      });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      if (!adapter) {
        throw Object.assign(
          new Error(`No adapter available for partner ${partnerId}`),
          { code: "ADAPTER_NOT_FOUND", statusCode: 500 },
        );
      }
      const normalizedShipmentData = {
        ...shipmentData,
        pickupAddress: {
          ...shipmentData.pickupAddress,
          phone: normalizeIndianPhone(shipmentData.pickupAddress?.phone),
        },
        deliveryAddress: {
          ...shipmentData.deliveryAddress,
          phone: normalizeIndianPhone(shipmentData.deliveryAddress?.phone),
        },
      };

      const result = await adapter.createOrder(normalizedShipmentData);

      if (!result?.awbNumber) {
        const pkg = result?.rawResponse?.packages?.[0];
        const packageRemarks = pkg?.remarks || [];
        const packageStatus = pkg?.status;

        const msg =
          (packageRemarks.length > 0
            ? packageRemarks.filter(Boolean).join("; ")
            : null) ||
          result?.rawResponse?.rmk ||
          result?.bookingReference ||
          "Courier booking failed (AWB not generated)";

        logger.warn("Courier booking did not return AWB", {
          partnerId,
          orderId: normalizedShipmentData.orderId,
          aggregatorType: channel.aggregatorType,
          packageStatus,
          packageRemarks,
          rmk: result?.rawResponse?.rmk,
        });

        throw Object.assign(new Error(msg), {
          code: "COURIER_BOOKING_FAILED",
          statusCode: 400,
          details: {
            partnerId,
            orderId: normalizedShipmentData.orderId,
            aggregatorType: channel.aggregatorType,
            bookingReference: result?.bookingReference || null,
            packageStatus,
            packageRemarks,
          },
        });
      }

      if (result && result.awbNumber) {
        await prisma.partnerShipment.create({
          data: {
            partnerId,
            shipmentId: shipmentData.shipmentId || null,
            partnerAwbNo: result.awbNumber,
            status: "BOOKED",
            trackingUrl: result.trackingUrl || null,
            calculatedRate: shipmentData.declaredValue || 0,
            codAmount:
              shipmentData.paymentType === "COD" ? shipmentData.codAmount : 0,
            serviceType: "SURFACE",
          },
        });
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "CREATE",
          resourceType: "COURIER_SHIPMENT",
          resourceId: result?.awbNumber || null,
          userId,
          requestData: {
            partnerId,
            orderId: normalizedShipmentData.orderId,
            awbNumber: result?.awbNumber,
          },
          ipAddress: null,
          userAgent: null,
        },
      });

      logger.info("Shipment booked successfully", {
        partnerId,
        awbNumber: result?.awbNumber,
      });

      return {
        success: true,
        awbNumber: result?.awbNumber,
        orderId: shipmentData.orderId,
        courierResponse: result,
      };
    } catch (error) {
      logger.error("Error booking shipment", {
        partnerId,
        orderId: shipmentData?.orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel a shipment with the courier partner
   * @param {string} partnerId - Partner ID
   * @param {string} awbNumber - AWB number to cancel
   * @param {string} reason - Cancellation reason
   * @param {string} [userId] - User ID for audit logging
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelShipment(partnerId, awbNumber, reason, userId) {
    try {
      logger.info("Cancelling shipment", { partnerId, awbNumber, reason });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      const result = await adapter.cancelOrder(awbNumber, reason);

      // Update PartnerShipment status
      await prisma.partnerShipment.updateMany({
        where: {
          partnerId,
          partnerAwbNo: awbNumber,
        },
        data: {
          status: "CANCELLED",
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          resourceType: "COURIER_SHIPMENT",
          resourceId: awbNumber,
          userId,
          requestData: { partnerId, awbNumber, reason, newStatus: "CANCELLED" },
          ipAddress: null,
          userAgent: null,
        },
      });

      logger.info("Shipment cancelled successfully", {
        partnerId,
        awbNumber,
      });

      return {
        success: true,
        awbNumber,
        courierResponse: result,
      };
    } catch (error) {
      logger.error("Error cancelling shipment", {
        partnerId,
        awbNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Track a shipment by AWB number
   * @param {string} partnerId - Partner ID
   * @param {string} awbNumber - AWB number to track
   * @returns {Promise<Object>} Normalized tracking data
   */
  async trackShipment(partnerId, awbNumber) {
    try {
      logger.info("Tracking shipment", { partnerId, awbNumber });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      const result = await adapter.trackShipment(awbNumber);

      logger.info("Shipment tracking retrieved", {
        partnerId,
        awbNumber,
      });

      return {
        success: true,
        awbNumber,
        trackingData: result,
      };
    } catch (error) {
      logger.error("Error tracking shipment", {
        partnerId,
        awbNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Request a pickup from the courier partner
   * @param {string} partnerId - Partner ID
   * @param {Object} pickupData - Pickup request details
   * @param {string} [userId] - User ID for audit logging
   * @returns {Promise<Object>} Pickup request result
   */
  async requestPickup(partnerId, pickupData, userId) {
    try {
      logger.info("Requesting pickup", {
        partnerId,
        pickupDate: pickupData.pickupDate,
        packageCount: pickupData.packageCount,
      });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      const result = await adapter.requestPickup(pickupData);

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "CREATE",
          resourceType: "COURIER_PICKUP",
          resourceId: result?.pickupId || null,
          userId,
          requestData: {
            partnerId,
            pickupDate: pickupData.pickupDate,
            packageCount: pickupData.packageCount,
          },
          ipAddress: null,
          userAgent: null,
        },
      });

      logger.info("Pickup requested successfully", {
        partnerId,
        pickupId: result?.pickupId,
      });

      return {
        success: true,
        courierResponse: result,
      };
    } catch (error) {
      logger.error("Error requesting pickup", {
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get shipping label for a shipment
   * @param {string} partnerId - Partner ID
   * @param {string} awbNumber - AWB number
   * @param {string} [format='pdf'] - Label format
   * @returns {Promise<Object>} Label data (URL or binary)
   */
  async getShippingLabel(partnerId, awbNumber, format) {
    try {
      logger.info("Getting shipping label", {
        partnerId,
        awbNumber,
        format,
      });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      const result = await adapter.getLabel(awbNumber, format);

      logger.info("Shipping label retrieved", {
        partnerId,
        awbNumber,
      });

      return {
        success: true,
        awbNumber,
        labelData: result,
      };
    } catch (error) {
      logger.error("Error getting shipping label", {
        partnerId,
        awbNumber,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate manifest for multiple shipments
   * @param {string} partnerId - Partner ID
   * @param {string[]} awbNumbers - List of AWB numbers
   * @param {string} [userId] - User ID for audit logging
   * @returns {Promise<Object>} Manifest result
   */
  async generateManifest(partnerId, awbNumbers, userId) {
    try {
      logger.info("Generating manifest", {
        partnerId,
        awbCount: awbNumbers.length,
      });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      const result = await adapter.generateManifest(awbNumbers);

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: "CREATE",
          resourceType: "COURIER_MANIFEST",
          resourceId: result?.manifestId || null,
          userId,
          requestData: {
            partnerId,
            awbNumbers,
            awbCount: awbNumbers.length,
          },
          ipAddress: null,
          userAgent: null,
        },
      });

      logger.info("Manifest generated successfully", {
        partnerId,
        manifestId: result?.manifestId,
      });

      return {
        success: true,
        courierResponse: result,
      };
    } catch (error) {
      logger.error("Error generating manifest", {
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check courier serviceability for a pincode
   * @param {string} partnerId - Partner ID
   * @param {string} pincode - 6-digit Indian pincode
   * @returns {Promise<Object>} Serviceability result
   */
  async checkCourierServiceability(partnerId, pincode) {
    try {
      logger.info("Checking courier serviceability", {
        partnerId,
        pincode,
      });

      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      const result = await adapter.checkPincodeServiceability(pincode);

      logger.info("Serviceability check complete", {
        partnerId,
        pincode,
        serviceable: result?.serviceable,
      });

      return {
        success: true,
        pincode,
        serviceabilityData: result,
      };
    } catch (error) {
      logger.error("Error checking courier serviceability", {
        partnerId,
        pincode,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get capabilities and available actions for a shipment/partner combination
   * @param {string} partnerId - Partner ID
   * @param {Object} shipmentContext - { status, bookingStatus, awbNumber, paymentType }
   * @returns {Promise<Object>} { capabilities, availableActions, providerName }
   */
  async getShipmentCapabilities(partnerId, shipmentContext) {
    try {
      const channel = await this._getValidatedChannel(partnerId);
      const adapter = createAdapter(channel);
      if (!adapter) {
        throw Object.assign(
          new Error(`No adapter available for partner ${partnerId}`),
          { code: "ADAPTER_NOT_FOUND", statusCode: 500 },
        );
      }

      const capabilities = adapter.getCapabilities();
      const availableActions = adapter.getAvailableActions(shipmentContext);

      return {
        success: true,
        providerName: channel.channelName || channel.aggregatorType,
        aggregatorType: channel.aggregatorType,
        capabilities,
        availableActions,
      };
    } catch (error) {
      logger.error("Error getting shipment capabilities", {
        partnerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get list of supported aggregator types
   * @returns {Array} Supported aggregator types
   */
  getSupportedAggregators() {
    return getSupportedAggregators();
  }
}

module.exports = new CourierOperationService();
