/**
 * BlueDart Courier Adapter
 *
 * Implements the BaseCourierAdapter for BlueDart API integration.
 * Handles order creation, tracking, cancellation, pickup requests,
 * label generation, manifest creation, and pincode serviceability.
 *
 * API Reference: BlueDart API Transit v1
 *
 * Authentication:
 * - API key sent via `ClientID` header
 * - License key included in the request body Profile object
 */

const BaseCourierAdapter = require("./BaseCourierAdapter");
const logger = require("../shared/lib/logger");

class BlueDartAdapter extends BaseCourierAdapter {
  constructor(channelConfig) {
    super(channelConfig);

    // BlueDart credentials from aggregatorConfig with env var fallback
    this.licenseKey =
      this.config.licenseKey || process.env.BLUEDART_LICENSE_KEY || "";
    this.loginId = this.config.loginId || process.env.BLUEDART_LOGIN_ID || "";
    this.customerCode =
      this.config.customerCode || process.env.BLUEDART_CUSTOMER_CODE || "";
    this.area = this.config.area || process.env.BLUEDART_AREA || "";
    this.originArea =
      this.config.originArea || process.env.BLUEDART_ORIGIN_AREA || "";

    // Set up axios instance with BlueDart auth headers
    this.client.defaults.headers.common["ClientID"] =
      this.apiKey || process.env.BLUEDART_API_KEY || "";
    this.client.defaults.headers.common["Content-Type"] = "application/json";

    logger.info("BlueDartAdapter initialized", {
      channelName: this.channelName,
      loginId: this.loginId,
      customerCode: this.customerCode,
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Build the BlueDart Profile object included in every request body
   * @returns {Object} Profile object with license key and login credentials
   */
  buildProfile() {
    return {
      LicenceKey: this.licenseKey,
      LoginID: this.loginId,
      Api_type: "S",
    };
  }

  /**
   * Create a shipment order with BlueDart (Waybill Generation)
   * @param {Object} shipmentData - Shipment details
   * @returns {Object} Standardized order creation response
   */
  async createOrder(shipmentData) {
    const payload = {
      Profile: this.buildProfile(),
      Request: {
        Shipper: {
          CustomerCode: this.customerCode,
          CustomerName: shipmentData.pickupAddress.name,
          CustomerAddress1: shipmentData.pickupAddress.address,
          CustomerPincode: shipmentData.pickupAddress.pincode,
          CustomerMobile: shipmentData.pickupAddress.phone,
          OriginArea: this.originArea,
          Sender: shipmentData.pickupAddress.name,
          VendorCode: this.config.vendorCode || "",
        },
        Consignee: {
          ConsigneeName: shipmentData.deliveryAddress.name,
          ConsigneeAddress1: shipmentData.deliveryAddress.address,
          ConsigneePincode: shipmentData.deliveryAddress.pincode,
          ConsigneeMobile: shipmentData.deliveryAddress.phone,
          ConsigneeCity: shipmentData.deliveryAddress.city,
          ConsigneeState: shipmentData.deliveryAddress.state,
        },
        Services: {
          ProductCode: shipmentData.paymentType === "COD" ? "C" : "D",
          ProductType: shipmentData.paymentType === "COD" ? "COD" : "Prepaid",
          ActualWeight: shipmentData.packageDetails.weight || 0.5,
          CreditReferenceNo: shipmentData.orderId,
          DeclaredValue:
            shipmentData.declaredValue || shipmentData.codAmount || 0,
          CollectableAmount:
            shipmentData.paymentType === "COD" ? shipmentData.codAmount : 0,
          PieceCount: shipmentData.packageDetails.quantity || 1,
          Dimensions: {
            Length: shipmentData.packageDetails.length || 10,
            Breadth: shipmentData.packageDetails.width || 10,
            Height: shipmentData.packageDetails.height || 10,
          },
          CommodityDetail1: shipmentData.productDescription || "Package",
          HSCode: shipmentData.hsnCode || "",
        },
      },
    };

    logger.info("Creating BlueDart order", {
      orderId: shipmentData.orderId,
      paymentType: shipmentData.paymentType,
      deliveryPincode: shipmentData.deliveryAddress.pincode,
    });

    const response = await this.makeRequest({
      method: "POST",
      url: "/in/Transportation/WaybillGeneration/v1",
      data: payload,
    });

    const generatedAwb = response.GenerateWaybillResult
      ? response.GenerateWaybillResult.AWBNo || null
      : null;

    return {
      success: !!generatedAwb,
      awbNumber: generatedAwb,
      bookingReference: response.GenerateWaybillResult
        ? response.GenerateWaybillResult.DestinationArea || null
        : null,
      trackingUrl: generatedAwb
        ? `https://www.bluedart.com/tracking/${generatedAwb}`
        : null,
      estimatedDelivery: response.GenerateWaybillResult
        ? response.GenerateWaybillResult.EstimatedDeliveryDate || null
        : null,
      rawResponse: response,
    };
  }

  /**
   * Cancel a BlueDart shipment order
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation response
   */
  async cancelOrder(awbNumber, reason) {
    logger.info("Cancelling BlueDart order", { awbNumber, reason });

    const payload = {
      Profile: this.buildProfile(),
      Request: {
        AWBNo: awbNumber,
        CancellationReason: reason || "Customer requested cancellation",
      },
    };

    const response = await this.makeRequest({
      method: "POST",
      url: "/in/Transportation/CancelBooking/v1",
      data: payload,
    });

    return {
      success: response.CancelWaybillResult
        ? response.CancelWaybillResult.Status === "Success" ||
          response.CancelWaybillResult.CancelledAWBs?.includes(awbNumber)
        : false,
      awbNumber,
      message: response.CancelWaybillResult
        ? response.CancelWaybillResult.StatusMessage ||
          "Order cancellation requested"
        : "Order cancellation requested",
      rawResponse: response,
    };
  }

  /**
   * Track a BlueDart shipment
   * @param {string} awbNumber - AWB/tracking number
   * @returns {Object} Tracking response with normalized events
   */
  async trackShipment(awbNumber) {
    const cacheKey = `courier:bluedart:track:${awbNumber}`;

    // Check cache first (5 min TTL)
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached BlueDart tracking", { awbNumber });
      return cached;
    }

    logger.info("Tracking BlueDart shipment", { awbNumber });

    const response = await this.makeRequest({
      method: "GET",
      url: `/in/Transportation/Tracking/v1`,
      params: {
        AWBNo: awbNumber,
        LicenceKey: this.licenseKey,
        LoginID: this.loginId,
      },
    });

    const trackingResult =
      response.TrackingResult || response.GetTrackingResult || null;
    const scans = trackingResult
      ? trackingResult.Scans || trackingResult.ScanDetails || []
      : [];
    const currentStatus = trackingResult
      ? trackingResult.Status || trackingResult.CurrentStatus || "Unknown"
      : "Unknown";
    const currentLocation = trackingResult
      ? trackingResult.StatusLocation || trackingResult.CurrentLocation || null
      : null;

    const result = {
      success: !!trackingResult,
      awbNumber,
      currentStatus: this.normalizeStatus(currentStatus),
      currentLocation,
      events: this.normalizeTrackingEvents(scans),
      estimatedDelivery: trackingResult
        ? trackingResult.ExpectedDeliveryDate || null
        : null,
      rawResponse: response,
    };

    // Cache for 5 minutes
    await this.setCachedResponse(cacheKey, result, 300);

    return result;
  }

  /**
   * Request pickup from BlueDart
   * @param {Object} pickupData - Pickup details
   * @returns {Object} Pickup request response
   */
  async requestPickup(pickupData) {
    logger.info("Requesting BlueDart pickup", {
      pickupDate: pickupData.pickup_date,
      expectedPackageCount: pickupData.expected_package_count,
    });

    const payload = {
      Profile: this.buildProfile(),
      Request: {
        CustomerCode: this.customerCode,
        OriginArea: this.originArea,
        PickupDate: pickupData.pickup_date,
        PickupTime: pickupData.pickup_time || "1400",
        NumberOfPieces: pickupData.expected_package_count || 1,
        ActualWeight: pickupData.total_weight || 1,
        ContactPersonName: pickupData.contact_person || "",
        ContactPersonNumber: pickupData.contact_phone || "",
        ReferenceNumber: pickupData.reference_number || "",
      },
    };

    const response = await this.makeRequest({
      method: "POST",
      url: "/in/Transportation/PickupRegistration/v1",
      data: payload,
    });

    const pickupResult = response.PickupRegistrationResult || response;

    return {
      success: !!pickupResult.TokenNumber || !!pickupResult.PickupID,
      pickupId: pickupResult.TokenNumber || pickupResult.PickupID || null,
      message: pickupResult.StatusMessage || "Pickup request submitted",
      rawResponse: response,
    };
  }

  /**
   * Get shipping label from BlueDart (returns PDF)
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} format - Label format (default: pdf)
   * @returns {Object} Label data response
   */
  async getLabel(awbNumber, format) {
    logger.info("Fetching BlueDart label", { awbNumber, format });

    const response = await this.makeRequest({
      method: "GET",
      url: "/in/Transportation/WaybillLabel/v1",
      params: {
        AWBNo: awbNumber,
        LicenceKey: this.licenseKey,
        LoginID: this.loginId,
      },
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
   * Generate manifest for BlueDart shipments
   * @param {string[]} awbNumbers - Array of AWB numbers
   * @returns {Object} Manifest generation response
   */
  async generateManifest(awbNumbers) {
    logger.info("Generating BlueDart manifest", {
      awbCount: awbNumbers.length,
    });

    const payload = {
      Profile: this.buildProfile(),
      Request: {
        AWBNos: awbNumbers,
        CustomerCode: this.customerCode,
        OriginArea: this.originArea,
      },
    };

    const response = await this.makeRequest({
      method: "POST",
      url: "/in/Transportation/ManifestGeneration/v1",
      data: payload,
    });

    const manifestResult = response.ManifestResult || response;

    return {
      success: true,
      manifestId:
        manifestResult.ManifestNumber || manifestResult.ManifestID || null,
      awbNumbers,
      rawResponse: response,
    };
  }

  /**
   * Check pincode serviceability with BlueDart
   * @param {string} pincode - 6-digit Indian pincode
   * @returns {Object} Serviceability response
   */
  async checkPincodeServiceability(pincode) {
    const cacheKey = `courier:bluedart:pincode:${pincode}`;

    // Check cache first (24 hour TTL for pincode data)
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached BlueDart pincode serviceability", {
        pincode,
      });
      return cached;
    }

    logger.info("Checking BlueDart pincode serviceability", { pincode });

    const response = await this.makeRequest({
      method: "GET",
      url: "/in/Transportation/PincodeService/v1",
      params: {
        pincode,
        LicenceKey: this.licenseKey,
        LoginID: this.loginId,
      },
    });

    const pincodeData =
      response.PincodeServiceResult || response.GetServicesforPincode || null;

    const isServiceable = pincodeData
      ? !!(
          pincodeData.ApexInbound === "Y" ||
          pincodeData.IsServiceable === "Y" ||
          pincodeData.AreaCode
        )
      : false;

    const result = {
      success: true,
      pincode,
      isServiceable,
      deliveryDays: pincodeData
        ? pincodeData.MaxDays || pincodeData.TransitDays || null
        : null,
      prepaidAvailable: pincodeData
        ? pincodeData.Prepaid === "Y" || pincodeData.IsPrePaidAir === "Y"
        : false,
      codAvailable: pincodeData
        ? pincodeData.COD === "Y" || pincodeData.IsCOD === "Y"
        : false,
      rawResponse: response,
    };

    // Cache for 24 hours
    await this.setCachedResponse(cacheKey, result, 86400);

    return result;
  }

  /**
   * Normalize BlueDart status to internal status
   * @param {string} courierStatus - BlueDart status string
   * @returns {string} Internal status
   */
  normalizeStatus(courierStatus) {
    const statusMap = {
      Booked: "BOOKED",
      "Picked Up": "BOOKED",
      "In Transit": "IN_TRANSIT",
      Dispatched: "IN_TRANSIT",
      "Arrived At Hub": "IN_TRANSIT",
      "Out for Delivery": "OUT_FOR_DELIVERY",
      "Out For Delivery": "OUT_FOR_DELIVERY",
      Delivered: "DELIVERED",
      Cancelled: "CANCELLED",
      Returned: "RTO",
      RTO: "RTO",
      "Returned to Origin": "RTO",
      Pending: "CREATED",
      "Not Picked": "CREATED",
    };

    return statusMap[courierStatus] || "IN_TRANSIT";
  }

  /**
   * Normalize BlueDart tracking events (scan events) to internal format
   * @param {Array} scans - BlueDart scan events array
   * @returns {Array} Normalized tracking events [{status, message, location, timestamp, source, metadata}]
   */
  normalizeTrackingEvents(scans) {
    if (!Array.isArray(scans)) {
      return [];
    }

    return scans.map((scan) => {
      const scanDetail = scan.ScanDetail || scan;
      const rawStatus =
        scanDetail.Instructions ||
        scanDetail.Status ||
        scanDetail.Activity ||
        "";

      return {
        status: this.normalizeStatus(
          scanDetail.Scan || scanDetail.ScanType || rawStatus,
        ),
        message:
          scanDetail.Instructions ||
          scanDetail.Activity ||
          scanDetail.StatusDescription ||
          "",
        location:
          scanDetail.ScannedLocation ||
          scanDetail.ScanLocation ||
          scanDetail.Location ||
          "",
        timestamp:
          scanDetail.ScanDateTime ||
          scanDetail.StatusDateTime ||
          scanDetail.Date ||
          null,
        source: "PARTNER",
        metadata: {
          courierName: "BlueDart",
          rawStatus,
        },
      };
    });
  }

  getCapabilities() {
    return {
      track: {
        supported: true,
        requiresAwb: true,
        description: "Track shipment via BlueDart API",
      },
      label: {
        supported: true,
        requiresAwb: true,
        description: "Download waybill label from BlueDart",
      },
      cancel: {
        supported: true,
        requiresAwb: true,
        allowedStatuses: ["BOOKED", "CREATED"],
        description: "Cancel booking via BlueDart API",
      },
      pickup: {
        supported: true,
        requiresAwb: false,
        description: "Register pickup with BlueDart",
      },
      manifest: {
        supported: true,
        requiresAwb: true,
        description: "Generate manifest",
      },
      edit: {
        supported: false,
        requiresAwb: true,
        description: "Edit not supported by BlueDart API",
      },
      ndr: {
        supported: false,
        requiresAwb: true,
        description: "NDR not supported via BlueDart API",
      },
      ewaybill: {
        supported: false,
        requiresAwb: true,
        description: "E-waybill not supported",
      },
      pod: {
        supported: false,
        requiresAwb: true,
        description: "POD not available via API",
      },
      invoice: {
        supported: false,
        requiresAwb: true,
        description: "Invoice not available via API",
      },
      refresh: {
        supported: true,
        requiresAwb: true,
        description: "Fetch latest tracking from BlueDart",
      },
      webhook: {
        supported: false,
        requiresAwb: false,
        description: "BlueDart webhook not implemented",
      },
    };
  }

  getAvailableActions(shipmentContext) {
    const caps = this.getCapabilities();
    const actions = [];
    const status = shipmentContext.status;

    for (const [action, meta] of Object.entries(caps)) {
      if (!meta.supported) continue;

      let enabled = true;
      let reason = null;

      if (meta.requiresAwb && !shipmentContext.awbNumber) {
        enabled = false;
        reason = "AWB number not yet assigned";
      }

      if (meta.allowedStatuses && !meta.allowedStatuses.includes(status)) {
        enabled = false;
        reason = `Not available in ${status} status`;
      }

      if (
        action === "cancel" &&
        ["DELIVERED", "RTO", "CANCELLED", "IN_TRANSIT"].includes(status)
      ) {
        continue;
      }

      actions.push({ action, description: meta.description, enabled, reason });
    }

    return actions;
  }
}

module.exports = BlueDartAdapter;
