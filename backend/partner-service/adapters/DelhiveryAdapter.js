/**
 * Delhivery Courier Adapter
 *
 * Implements the BaseCourierAdapter for Delhivery One API integration.
 * Handles order creation, tracking, cancellation, pickup requests,
 * label generation, manifest creation, and pincode serviceability.
 *
 * API Reference: Delhivery One API
 */

const BaseCourierAdapter = require("./BaseCourierAdapter");
const logger = require("../shared/lib/logger");

class DelhiveryAdapter extends BaseCourierAdapter {
  constructor(channelConfig) {
    super(channelConfig);

    this.clientName =
      this.config.clientName || process.env.DELHIVERY_CLIENT_NAME || "";

    // Set up axios instance with Delhivery auth headers
    this.client.defaults.headers.common["Authorization"] =
      `Token ${this.apiKey}`;
    this.client.defaults.headers.common["Content-Type"] = "application/json";

    logger.info("DelhiveryAdapter initialized", {
      channelName: this.channelName,
      clientName: this.clientName,
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Create a shipment order with Delhivery
   * @param {Object} shipmentData - Shipment details
   * @returns {Object} Standardized order creation response
   */
  async createOrder(shipmentData) {
    const shipmentPayload = {
      shipments: [
        {
          name: shipmentData.deliveryAddress.name,
          add: shipmentData.deliveryAddress.address,
          pin: shipmentData.deliveryAddress.pincode,
          city: shipmentData.deliveryAddress.city,
          state: shipmentData.deliveryAddress.state,
          country: "India",
          phone: shipmentData.deliveryAddress.phone,
          order: shipmentData.orderId,
          payment_mode: shipmentData.paymentType === "COD" ? "COD" : "Prepaid",
          cod_amount:
            shipmentData.paymentType === "COD" ? shipmentData.codAmount : 0,
          return_pin: shipmentData.pickupAddress.pincode,
          return_city: shipmentData.pickupAddress.city,
          return_phone: shipmentData.pickupAddress.phone,
          return_add: shipmentData.pickupAddress.address,
          return_state: shipmentData.pickupAddress.state,
          return_country: "India",
          return_name: shipmentData.pickupAddress.name,
          weight: shipmentData.packageDetails.weight * 1000, // kg to grams
          shipment_width: shipmentData.packageDetails.width || 10,
          shipment_height: shipmentData.packageDetails.height || 10,
          shipment_length: shipmentData.packageDetails.length || 10,
          product_desc: shipmentData.productDescription || "Package",
          hsn_code: shipmentData.hsnCode || "",
          seller_name: this.clientName,
          pickup_location:
            this.config.pickupLocation || this.config.warehouseName || "",
        },
      ],
      pickup_location: {
        name: this.config.pickupLocation || this.config.warehouseName || "",
      },
    };

    logger.info("Creating Delhivery order", {
      orderId: shipmentData.orderId,
      paymentType: shipmentData.paymentType,
      deliveryPincode: shipmentData.deliveryAddress.pincode,
    });

    const response = await this.makeRequest({
      method: "POST",
      url: "/api/cmu/create.json",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: `format=json&data=${JSON.stringify(shipmentPayload)}`,
    });

    const awbNumber =
      response.packages && response.packages[0]
        ? response.packages[0].waybill
        : null;

    return {
      success: !!awbNumber,
      awbNumber,
      bookingReference: response.rmk || response.upload_wbn || null,
      trackingUrl: awbNumber
        ? `https://www.delhivery.com/track/package/${awbNumber}`
        : null,
      estimatedDelivery: null,
      rawResponse: response,
    };
  }

  /**
   * Cancel a Delhivery shipment order
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation response
   */
  async cancelOrder(awbNumber, reason) {
    logger.info("Cancelling Delhivery order", { awbNumber, reason });

    const response = await this.makeRequest({
      method: "POST",
      url: "/api/p/edit",
      data: {
        waybill: awbNumber,
        cancellation: true,
      },
    });

    return {
      success: true,
      awbNumber,
      message: response.status || "Order cancellation requested",
      rawResponse: response,
    };
  }

  /**
   * Track a Delhivery shipment
   * @param {string} awbNumber - AWB/tracking number
   * @returns {Object} Tracking response with normalized events
   */
  async trackShipment(awbNumber) {
    const cacheKey = `courier:delhivery:track:${awbNumber}`;

    // Check cache first
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached Delhivery tracking", { awbNumber });
      return cached;
    }

    logger.info("Tracking Delhivery shipment", { awbNumber });

    const response = await this.makeRequest({
      method: "GET",
      url: `/api/v1/packages/json/?waybill=${awbNumber}&token=${this.apiKey}`,
    });

    const shipmentData =
      response.ShipmentData && response.ShipmentData[0]
        ? response.ShipmentData[0]
        : null;

    const scans =
      shipmentData && shipmentData.Shipment && shipmentData.Shipment.Scans
        ? shipmentData.Shipment.Scans
        : [];

    const currentStatus =
      shipmentData && shipmentData.Shipment && shipmentData.Shipment.Status
        ? shipmentData.Shipment.Status.Status
        : "Unknown";

    const currentLocation =
      shipmentData &&
      shipmentData.Shipment &&
      shipmentData.Shipment.Status &&
      shipmentData.Shipment.Status.StatusLocation
        ? shipmentData.Shipment.Status.StatusLocation
        : null;

    const result = {
      success: !!shipmentData,
      awbNumber,
      currentStatus: this.normalizeStatus(currentStatus),
      currentLocation,
      events: this.normalizeTrackingEvents(scans),
      estimatedDelivery:
        shipmentData && shipmentData.Shipment
          ? shipmentData.Shipment.ExpectedDeliveryDate || null
          : null,
      rawResponse: response,
    };

    // Cache the tracking result
    await this.setCachedResponse(cacheKey, result, 300);

    return result;
  }

  /**
   * Request pickup from Delhivery
   * @param {Object} pickupData - Pickup details
   * @returns {Object} Pickup request response
   */
  async requestPickup(pickupData) {
    logger.info("Requesting Delhivery pickup", {
      pickupLocation: pickupData.pickup_location,
      expectedPackageCount: pickupData.expected_package_count,
    });

    const response = await this.makeRequest({
      method: "POST",
      url: "/fm/request/new/",
      data: {
        pickup_location: pickupData.pickup_location,
        expected_package_count: pickupData.expected_package_count,
        pickup_date: pickupData.pickup_date,
        pickup_time: pickupData.pickup_time,
      },
    });

    return {
      success: true,
      pickupId: response.pickup_id || response.pk || null,
      message: response.status || "Pickup request submitted",
      rawResponse: response,
    };
  }

  /**
   * Get shipping label from Delhivery
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} format - Label format
   * @returns {Object} Label data response
   */
  async getLabel(awbNumber, format) {
    logger.info("Fetching Delhivery label", { awbNumber, format });

    const response = await this.makeRequest({
      method: "GET",
      url: `/api/p/packing_slip?wbns=${awbNumber}&pdf=true`,
      responseType: "arraybuffer",
    });

    const labelData = Buffer.isBuffer(response)
      ? response.toString("base64")
      : response;

    return {
      success: true,
      awbNumber,
      labelData,
      format: "pdf",
      rawResponse: response,
    };
  }

  /**
   * Generate manifest for Delhivery shipments
   * @param {string[]} awbNumbers - Array of AWB numbers
   * @returns {Object} Manifest generation response
   */
  async generateManifest(awbNumbers) {
    logger.info("Generating Delhivery manifest", {
      awbCount: awbNumbers.length,
    });

    const response = await this.makeRequest({
      method: "POST",
      url: "/api/cmu/create.json",
      data: {
        waybills: awbNumbers,
      },
    });

    return {
      success: true,
      manifestId: response.manifest_id || null,
      awbNumbers,
      rawResponse: response,
    };
  }

  /**
   * Check pincode serviceability with Delhivery
   * @param {string} pincode - 6-digit Indian pincode
   * @returns {Object} Serviceability response
   */
  async checkPincodeServiceability(pincode) {
    const cacheKey = `courier:delhivery:pincode:${pincode}`;

    // Check cache first (pincode data is relatively stable)
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached Delhivery pincode serviceability", {
        pincode,
      });
      return cached;
    }

    logger.info("Checking Delhivery pincode serviceability", { pincode });

    const response = await this.makeRequest({
      method: "GET",
      url: `/c/api/pin-codes/json/?filter_codes=${pincode}`,
    });

    const deliveryCodesData =
      response.delivery_codes && response.delivery_codes[0]
        ? response.delivery_codes[0].postal_code
        : null;

    const result = {
      success: true,
      pincode,
      isServiceable: !!deliveryCodesData,
      deliveryDays: deliveryCodesData
        ? deliveryCodesData.max_days || null
        : null,
      prepaidAvailable: deliveryCodesData
        ? deliveryCodesData.pre_paid === "Y"
        : false,
      codAvailable: deliveryCodesData ? deliveryCodesData.cod === "Y" : false,
      rawResponse: response,
    };

    // Cache for 24 hours
    await this.setCachedResponse(cacheKey, result, 86400);

    return result;
  }

  /**
   * Normalize Delhivery status to internal status
   * @param {string} courierStatus - Delhivery status string
   * @returns {string} Internal status
   */
  normalizeStatus(courierStatus) {
    const statusMap = {
      Manifested: "BOOKED",
      "In Transit": "IN_TRANSIT",
      Dispatched: "IN_TRANSIT",
      "Out For Delivery": "OUT_FOR_DELIVERY",
      Delivered: "DELIVERED",
      RTO: "RTO",
      Returned: "RTO",
      Pending: "CREATED",
      "Not Picked": "CREATED",
      Cancelled: "CANCELLED",
    };

    return statusMap[courierStatus] || "IN_TRANSIT";
  }

  /**
   * Normalize Delhivery tracking events to internal format
   * @param {Array} scans - Delhivery scan events
   * @returns {Array} Normalized tracking events
   */
  normalizeTrackingEvents(scans) {
    if (!Array.isArray(scans)) {
      return [];
    }

    return scans.map((scan) => {
      const scanDetail = scan.ScanDetail || scan;
      const rawStatus = scanDetail.Instructions || scanDetail.Status || "";

      return {
        status: this.normalizeStatus(scanDetail.Scan || rawStatus),
        message: scanDetail.Instructions || scanDetail.StatusDescription || "",
        location: scanDetail.ScannedLocation || scanDetail.ScanLocation || "",
        timestamp: scanDetail.ScanDateTime || scanDetail.StatusDateTime || null,
        source: "PARTNER",
        metadata: {
          courierName: "Delhivery",
          rawStatus,
        },
      };
    });
  }
}

module.exports = DelhiveryAdapter;
