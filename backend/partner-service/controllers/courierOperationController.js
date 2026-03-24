/**
 * Courier Operation Controller
 *
 * Handles HTTP requests for courier operations (book, cancel, track, pickup, label, manifest, serviceability).
 * All business logic is delegated to courierOperationService.
 * Follows controller pattern - NO inline logic in routes.
 */

const courierOperationService = require("../services/courierOperationService");
const logger = require("../shared/lib/logger");

class CourierOperationController {
  /**
   * Book a shipment with a courier partner
   * POST /api/v1/courier-operations/book
   */
  async bookShipment(req, res) {
    try {
      const userId = req.user?.id;
      const { partnerId, ...shipmentData } = req.body;

      logger.info("Book shipment request", {
        partnerId,
        orderId: shipmentData.orderId,
      });

      const result = await courierOperationService.bookShipment(
        partnerId,
        shipmentData,
        userId,
      );

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in bookShipment controller", {
        error: error.message,
      });

      const statusCode =
        error.statusCode || (error.code === "CHANNEL_NOT_FOUND" ? 404 : 500);

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Cancel a courier shipment
   * POST /api/v1/courier-operations/cancel
   */
  async cancelShipment(req, res) {
    try {
      const userId = req.user?.id;
      const { partnerId, awbNumber, reason } = req.body;

      logger.info("Cancel shipment request", { partnerId, awbNumber });

      const result = await courierOperationService.cancelShipment(
        partnerId,
        awbNumber,
        reason,
        userId,
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in cancelShipment controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Track a courier shipment
   * GET /api/v1/courier-operations/track/:partnerId/:awbNumber
   */
  async trackShipment(req, res) {
    try {
      const { partnerId, awbNumber } = req.params;

      logger.info("Track shipment request", { partnerId, awbNumber });

      const result = await courierOperationService.trackShipment(
        partnerId,
        awbNumber,
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in trackShipment controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Request pickup from courier
   * POST /api/v1/courier-operations/pickup
   */
  async requestPickup(req, res) {
    try {
      const userId = req.user?.id;
      const { partnerId, ...pickupData } = req.body;

      logger.info("Request pickup", { partnerId });

      const result = await courierOperationService.requestPickup(
        partnerId,
        pickupData,
        userId,
      );

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in requestPickup controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Get shipping label
   * GET /api/v1/courier-operations/label/:partnerId/:awbNumber
   */
  async getShippingLabel(req, res) {
    try {
      const { partnerId, awbNumber } = req.params;
      const { format } = req.query;

      logger.info("Get shipping label request", {
        partnerId,
        awbNumber,
        format,
      });

      const result = await courierOperationService.getShippingLabel(
        partnerId,
        awbNumber,
        format,
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in getShippingLabel controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Generate manifest for multiple AWBs
   * POST /api/v1/courier-operations/manifest
   */
  async generateManifest(req, res) {
    try {
      const userId = req.user?.id;
      const { partnerId, awbNumbers } = req.body;

      logger.info("Generate manifest request", {
        partnerId,
        awbCount: awbNumbers?.length,
      });

      const result = await courierOperationService.generateManifest(
        partnerId,
        awbNumbers,
        userId,
      );

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in generateManifest controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Check courier serviceability for a pincode
   * GET /api/v1/courier-operations/serviceability/:partnerId/:pincode
   */
  async checkServiceability(req, res) {
    try {
      const { partnerId, pincode } = req.params;

      logger.info("Check serviceability request", { partnerId, pincode });

      const result = await courierOperationService.checkCourierServiceability(
        partnerId,
        pincode,
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in checkServiceability controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Get shipment capabilities and available actions
   * POST /api/v1/courier-operations/capabilities
   */
  async getShipmentCapabilities(req, res) {
    try {
      const { partnerId, shipmentContext } = req.body;

      logger.info("Get shipment capabilities request", {
        partnerId,
        status: shipmentContext?.status,
      });

      const result = await courierOperationService.getShipmentCapabilities(
        partnerId,
        shipmentContext || {},
      );

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      logger.error("Error in getShipmentCapabilities controller", {
        error: error.message,
      });

      const statusCode = error.statusCode || 500;

      res.status(statusCode).json({
        status: "error",
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Get list of supported aggregator types
   * GET /api/v1/courier-operations/supported-aggregators
   */
  async getSupportedAggregators(req, res) {
    try {
      const aggregators = courierOperationService.getSupportedAggregators();

      res.status(200).json({
        status: "success",
        data: {
          aggregators,
          total: aggregators.length,
        },
      });
    } catch (error) {
      logger.error("Error in getSupportedAggregators controller", {
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
}

module.exports = new CourierOperationController();
