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

    if (!this.apiUrl) {
      this.apiUrl = "https://track.delhivery.com";
      this.client.defaults.baseURL = this.apiUrl;
    }

    this.clientName = this.config.clientName || "";

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

  getDerivedPickupLocationName(shipmentData) {
    const pincode = shipmentData?.pickupAddress?.pincode || "";
    const city = shipmentData?.pickupAddress?.city || "";
    const state = shipmentData?.pickupAddress?.state || "";

    const raw = [pincode, city, state].filter(Boolean).join("_");
    const normalized = raw
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

    if (!normalized) return "";
    return `WH_${normalized}`.slice(0, 50);
  }

  /**
   * Create a shipment order with Delhivery
   * @param {Object} shipmentData - Shipment details
   * @returns {Object} Standardized order creation response
   */
  async createOrder(shipmentData) {
    if (!this.apiKey) {
      throw Object.assign(new Error("Delhivery API token is missing"), {
        code: "DELHIVERY_CONFIG_MISSING",
        statusCode: 400,
      });
    }
    if (!this.clientName) {
      throw Object.assign(
        new Error(
          "Delhivery clientName is missing (must match your Delhivery One registered client name)",
        ),
        {
          code: "DELHIVERY_CONFIG_MISSING",
          statusCode: 400,
        },
      );
    }
    const derivedPickupLocationName =
      this.getDerivedPickupLocationName(shipmentData);
    const pickupLocationName =
      shipmentData.pickupLocation ||
      this.config.pickupLocation ||
      this.config.warehouseName ||
      derivedPickupLocationName ||
      "";

    const sellerName = this.clientName;

    const shipmentPayload = this.buildShipmentPayload(
      shipmentData,
      pickupLocationName,
      sellerName,
    );

    logger.info("Creating Delhivery order", {
      orderId: shipmentData.orderId,
      paymentType: shipmentData.paymentType,
      deliveryPincode: shipmentData.deliveryAddress.pincode,
      pickupLocation: pickupLocationName || null,
      clientName: this.clientName,
    });

    let response = await this.createOrderRequest(shipmentPayload);

    const remark = String(response?.rmk || "").toLowerCase();
    const missingWarehouse =
      remark.includes("clientwarehouse matching query does not exist") ||
      remark.includes("clientwarehouse matching query doesn't exist");

    if (missingWarehouse && pickupLocationName) {
      logger.warn(
        "Delhivery pickup location not found — auto-creating warehouse",
        {
          orderId: shipmentData.orderId,
          pickupLocation: pickupLocationName,
        },
      );

      let warehouseCreated = false;
      try {
        await this.createWarehouse(
          pickupLocationName,
          shipmentData.pickupAddress,
        );
        warehouseCreated = true;
      } catch (warehouseError) {
        // If creation timed out, the warehouse may still have been registered
        // on Delhivery's side — always retry the order regardless.
        const isTimeout =
          warehouseError.message?.includes("timeout") ||
          warehouseError.code === "ECONNABORTED";

        logger.error("Delhivery warehouse auto-creation failed", {
          orderId: shipmentData.orderId,
          pickupLocation: pickupLocationName,
          error: warehouseError.message,
          retryingOrder: isTimeout,
        });

        if (!isTimeout) {
          // Non-timeout failure (e.g. validation error) — no point retrying
          throw warehouseError;
        }
      }

      // Retry the order whether creation succeeded or timed out
      logger.info("Retrying Delhivery order after warehouse creation attempt", {
        orderId: shipmentData.orderId,
        pickupLocation: pickupLocationName,
        warehouseCreated,
      });
      response = await this.createOrderRequest(shipmentPayload);
    }

    const pkg = response.packages && response.packages[0];
    const awbNumber = pkg ? pkg.waybill : null;
    const packageStatus = pkg ? pkg.status : null;

    if (!awbNumber && packageStatus === "Fail") {
      const packageRemarks = pkg?.remarks || [];
      logger.error("Delhivery shipment creation failed at package level", {
        orderId: shipmentData.orderId,
        packageStatus,
        remarks: packageRemarks,
        rmk: response.rmk,
      });
    }

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

  buildShipmentPayload(shipmentData, pickupLocationName, sellerName) {
    return {
      shipments: [
        {
          name: shipmentData.deliveryAddress.name,
          add: shipmentData.deliveryAddress.address,
          pin: String(shipmentData.deliveryAddress.pincode),
          city: shipmentData.deliveryAddress.city,
          state: shipmentData.deliveryAddress.state,
          country: "India",
          phone: shipmentData.deliveryAddress.phone,
          order: shipmentData.orderId,
          payment_mode: shipmentData.paymentType === "COD" ? "COD" : "Prepaid",
          cod_amount:
            shipmentData.paymentType === "COD" ? shipmentData.codAmount : 0,
          return_pin: String(shipmentData.pickupAddress.pincode || ""),
          return_city: shipmentData.pickupAddress.city,
          return_phone: shipmentData.pickupAddress.phone,
          return_add: shipmentData.pickupAddress.address,
          return_state: shipmentData.pickupAddress.state,
          return_country: "India",
          return_name: shipmentData.pickupAddress.name,
          weight: shipmentData.packageDetails.weight * 1000,
          shipment_width: shipmentData.packageDetails.width || 10,
          shipment_height: shipmentData.packageDetails.height || 10,
          shipment_length: shipmentData.packageDetails.length || 10,
          products_desc: shipmentData.productDescription || "Package",
          hsn_code: shipmentData.hsnCode || "",
          seller_name: sellerName || "",
          pickup_location: pickupLocationName,
        },
      ],
      pickup_location: {
        name: pickupLocationName,
      },
    };
  }

  async createOrderRequest(shipmentPayload) {
    const body = new URLSearchParams();
    body.set("format", "json");
    body.set("data", JSON.stringify(shipmentPayload));
    return this.makeRequest({
      method: "POST",
      url: "/api/cmu/create.json",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: body.toString(),
    });
  }

  normalizeWarehousePhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) return digits;
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  async createWarehouse(warehouseName, pickupAddress) {
    const address =
      pickupAddress?.address ||
      pickupAddress?.addressLine1 ||
      pickupAddress?.pickupLine1 ||
      "";
    const pincode =
      pickupAddress?.pincode ||
      pickupAddress?.pin ||
      pickupAddress?.pickupPincode ||
      "";
    const city = pickupAddress?.city || pickupAddress?.pickupCity || "";
    const state = pickupAddress?.state || pickupAddress?.pickupState || "";
    const phone = this.normalizeWarehousePhone(
      pickupAddress?.phone || pickupAddress?.pickupPhone,
    );

    const payload = {
      name: warehouseName,
      address,
      city,
      pin: String(pincode || ""),
      country: "India",
      phone,
      email: pickupAddress?.email || "",
      return_address: address,
      return_city: city,
      return_state: state,
      return_pin: String(pincode || ""),
      return_country: "India",
    };

    try {
      // Use a longer timeout for warehouse creation (Delhivery can be slow)
      const response = await this.client.post(
        "/api/backend/clientwarehouse/create/",
        payload,
        { timeout: 30000 },
      );
      this.onSuccess();

      if (response?.data?.success === false) {
        const errorCodes = response?.data?.error_code || [];
        const errorMessages = Array.isArray(response?.data?.error)
          ? response.data.error
          : [];

        const isDuplicate = errorCodes.includes(2000);
        if (isDuplicate) {
          logger.info(
            "Delhivery warehouse already exists, proceeding with order",
            { warehouseName },
          );
          return response.data;
        }

        const errMessage =
          errorMessages.join(", ") ||
          response?.data?.data?.message ||
          "Delhivery warehouse creation failed";
        logger.error("Delhivery warehouse creation returned success=false", {
          warehouseName,
          errorCodes,
          data: response.data,
        });
        throw new Error(errMessage);
      }

      logger.info("Delhivery warehouse created successfully", {
        warehouseName,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        const errorCodes = data?.error_code || [];
        const isDuplicate = errorCodes.includes(2000);
        if (isDuplicate) {
          logger.info(
            "Delhivery warehouse already exists (from error response), proceeding with order",
            { warehouseName },
          );
          return data;
        }

        const message =
          (Array.isArray(data?.error) ? data.error.join(", ") : null) ||
          data?.data?.message ||
          data?.message ||
          (typeof data === "string" ? data : null) ||
          error.message;

        logger.error("Delhivery warehouse creation API error", {
          warehouseName,
          status,
          message,
          errorCodes,
          data,
        });
        this.onFailure();
        throw new Error(message);
      }

      this.onFailure();
      logger.error("Delhivery warehouse creation network error", {
        warehouseName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel a Delhivery shipment order
   * @param {string} awbNumber - AWB/tracking number
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation response
   */
  async cancelOrder(awbNumber, reason) {
    logger.info("Cancelling Delhivery order", { awbNumber, reason });

    const requestPayload = {
      waybill: awbNumber,
      cancellation: "true",
    };

    logger.info("Delhivery cancel request payload", {
      url: "/api/p/edit",
      payload: requestPayload,
    });

    const response = await this.makeRequest({
      method: "POST",
      url: "/api/p/edit",
      data: requestPayload,
    });

    logger.info("Delhivery cancel raw response", {
      awbNumber,
      rawResponse: JSON.stringify(response),
      responseType: typeof response,
      statusField: response.status,
      statusFieldType: typeof response.status,
      remarkField: response.remark,
      errorField: response.error,
    });

    const providerSuccess = response.status === true;
    const alreadyCancelled =
      providerSuccess &&
      typeof response.remark === "string" &&
      response.remark.toLowerCase().includes("already cancelled");

    if (!providerSuccess && !alreadyCancelled) {
      const errorMsg =
        response.error ||
        response.remark ||
        "Delhivery cancellation failed — unknown reason";
      logger.error("Delhivery cancel rejected", {
        awbNumber,
        response,
      });
      throw Object.assign(new Error(errorMsg), {
        code: "PROVIDER_CANCEL_REJECTED",
        statusCode: 400,
        rawResponse: response,
      });
    }

    logger.info("Delhivery cancel confirmed", {
      awbNumber,
      remark: response.remark,
      alreadyCancelled,
    });

    return {
      success: true,
      awbNumber,
      message: response.remark || "Shipment has been cancelled.",
      alreadyCancelled,
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

    const statusObj =
      shipmentData && shipmentData.Shipment && shipmentData.Shipment.Status
        ? shipmentData.Shipment.Status
        : {};

    const currentStatus = statusObj.Status || "Unknown";
    const statusInstructions = statusObj.Instructions || "";
    const statusCode = statusObj.StatusCode || "";

    const currentLocation = statusObj.StatusLocation || null;

    const result = {
      success: !!shipmentData,
      awbNumber,
      currentStatus: this.normalizeStatus(
        currentStatus,
        statusInstructions,
        statusCode,
      ),
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
  normalizeStatus(courierStatus, instructions = "", statusCode = "") {
    const lowerInstructions = (instructions || "").toLowerCase();
    const cancelledViaInstructions =
      lowerInstructions.includes("cancelled") ||
      lowerInstructions.includes("canceled");
    const cancelledViaCode = statusCode === "DTUP-210";

    if (cancelledViaInstructions || cancelledViaCode) {
      return "CANCELLED";
    }

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
      const scanType = scanDetail.Scan || rawStatus;
      const scanInstructions = scanDetail.Instructions || "";
      const scanStatusCode = scanDetail.StatusCode || "";

      return {
        status: this.normalizeStatus(
          scanType,
          scanInstructions,
          scanStatusCode,
        ),
        message: scanInstructions || scanDetail.StatusDescription || "",
        location: scanDetail.ScannedLocation || scanDetail.ScanLocation || "",
        timestamp: scanDetail.ScanDateTime || scanDetail.StatusDateTime || null,
        source: "PARTNER",
        metadata: {
          courierName: "Delhivery",
          rawStatus,
          statusCode: scanStatusCode,
        },
      };
    });
  }

  getCapabilities() {
    return {
      track: {
        supported: true,
        requiresAwb: true,
        description: "Track shipment via Delhivery API",
      },
      label: {
        supported: true,
        requiresAwb: true,
        description: "Download packing slip from Delhivery",
      },
      cancel: {
        supported: true,
        requiresAwb: true,
        allowedStatuses: ["BOOKED", "CREATED", "PICKED_UP"],
        description: "Cancel via /api/p/edit",
      },
      pickup: {
        supported: true,
        requiresAwb: false,
        description: "Request pickup via /fm/request/new/",
      },
      manifest: {
        supported: true,
        requiresAwb: true,
        description: "Generate manifest",
      },
      edit: {
        supported: true,
        requiresAwb: true,
        allowedStatuses: ["BOOKED", "CREATED"],
        description: "Edit shipment before dispatch via /api/p/edit",
      },
      ndr: {
        supported: true,
        requiresAwb: true,
        allowedStatuses: ["NDR", "OUT_FOR_DELIVERY"],
        description: "NDR action/status update",
      },
      ewaybill: {
        supported: true,
        requiresAwb: true,
        description: "E-waybill update",
      },
      pod: {
        supported: true,
        requiresAwb: true,
        allowedStatuses: ["DELIVERED"],
        description: "Download proof of delivery",
      },
      invoice: {
        supported: false,
        requiresAwb: true,
        description: "Courier invoice not available via API",
      },
      refresh: {
        supported: true,
        requiresAwb: true,
        description: "Fetch latest tracking from Delhivery",
      },
      webhook: {
        supported: true,
        requiresAwb: false,
        description: "Delhivery push webhook support",
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
        ["DELIVERED", "RTO", "CANCELLED"].includes(status)
      ) {
        continue;
      }

      if (
        action === "edit" &&
        [
          "IN_TRANSIT",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "RTO",
          "CANCELLED",
        ].includes(status)
      ) {
        continue;
      }

      actions.push({ action, description: meta.description, enabled, reason });
    }

    return actions;
  }
}

module.exports = DelhiveryAdapter;
