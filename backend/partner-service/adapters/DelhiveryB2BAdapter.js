/**
 * Delhivery B2B (LTL) Courier Adapter
 *
 * Implements BaseCourierAdapter for Delhivery's B2B/LTL freight API — a fully
 * separate integration from the B2C Express API:
 * - Auth: JWT via POST /ums/login/ (username/password, token valid 24h)
 * - Booking: async POST /v2/manifest → job_id → poll GET /v2/manifest?job_id=
 *   until Complete → LR number (LRN, stored as the AWB equivalent)
 * - Hosts: booking on btob.api.delhivery.com, serviceability on
 *   ltl-clients-api.delhivery.com (dev: btob-api-dev / ltl-clients-api-dev)
 * - No cancellation API (Delhivery One portal / account manager only)
 * - No rate API (contract rate card; freight priced by our charge rules)
 *
 * aggregatorConfig: { username, password, clientId, pickupLocationName,
 *                     ltlApiUrl?, labelSize? }
 */

const BaseCourierAdapter = require("./BaseCourierAdapter");
const logger = require("../shared/lib/logger");

const DEFAULT_BTOB_URL = "https://btob.api.delhivery.com";
const DEFAULT_LTL_URL = "https://ltl-clients-api.delhivery.com";

// JWT is valid 24h — cache for 20h to refresh well before expiry
const JWT_CACHE_TTL_SECONDS = 20 * 60 * 60;

// Async manifest job polling
const MANIFEST_POLL_ATTEMPTS = 10;
const MANIFEST_POLL_DELAY_MS = 3000;

class DelhiveryB2BAdapter extends BaseCourierAdapter {
  constructor(channelConfig) {
    super(channelConfig);

    if (!this.apiUrl) {
      this.apiUrl = DEFAULT_BTOB_URL;
      this.client.defaults.baseURL = this.apiUrl;
    }

    this.ltlApiUrl = this.config.ltlApiUrl || DEFAULT_LTL_URL;
    this.username = this.config.username || "";
    this.password = this.config.password || "";
    this.clientId = this.config.clientId || this.config.warehouseId || "";
    this.pickupLocationName = this.config.pickupLocationName || "";

    logger.info("DelhiveryB2BAdapter initialized", {
      channelName: this.channelName,
      apiUrl: this.apiUrl,
      ltlApiUrl: this.ltlApiUrl,
      username: this.username ? "(set)" : "(missing)",
    });
  }

  _requireCredentials() {
    if (!this.username || !this.password) {
      throw Object.assign(
        new Error(
          "Delhivery B2B username/password missing — set them on the channel's credential account",
        ),
        { code: "DELHIVERY_B2B_CONFIG_MISSING", statusCode: 400 },
      );
    }
  }

  _jwtCacheKey() {
    return `courier:delhivery_b2b:jwt:${this.username}`;
  }

  /**
   * Get a JWT for the B2B API, cached in Redis (~20h; token lives 24h).
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<string>} JWT
   */
  async getJwt(forceRefresh = false) {
    this._requireCredentials();

    const cacheKey = this._jwtCacheKey();
    if (!forceRefresh) {
      const cached = await this.getCachedResponse(cacheKey);
      if (cached?.jwt) return cached.jwt;
    }

    logger.info("Logging in to Delhivery B2B UMS", { username: this.username });

    const response = await this.makeRequest({
      method: "POST",
      url: "/ums/login/",
      headers: { "Content-Type": "application/json" },
      data: { username: this.username, password: this.password },
    });

    const jwt = response?.jwt;
    if (!jwt) {
      throw Object.assign(
        new Error("Delhivery B2B login did not return a JWT"),
        { code: "DELHIVERY_B2B_AUTH_FAILED", statusCode: 502 },
      );
    }

    await this.setCachedResponse(cacheKey, { jwt }, JWT_CACHE_TTL_SECONDS);
    return jwt;
  }

  /**
   * Make an authenticated request; on 401 re-login once and retry (token may
   * have been revoked before the cache TTL elapsed).
   * @param {Object} config - axios request config (url may be absolute for LTL host)
   * @returns {Promise<Object>} response data
   */
  async makeAuthenticatedRequest(config) {
    const jwt = await this.getJwt();
    try {
      return await this.makeRequest({
        ...config,
        headers: { ...(config.headers || {}), Authorization: `Bearer ${jwt}` },
      });
    } catch (error) {
      const unauthorized =
        error.message?.includes("401") || error.response?.status === 401;
      if (!unauthorized) throw error;

      logger.warn("Delhivery B2B JWT rejected — re-authenticating", {
        username: this.username,
      });
      const freshJwt = await this.getJwt(true);
      return this.makeRequest({
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${freshJwt}`,
        },
      });
    }
  }

  /**
   * Create a B2B (LTL) shipment: submit manifest job, poll until complete,
   * return the LR number as the AWB equivalent.
   * @param {Object} shipmentData - Standard booking payload
   * @returns {Object} { success, awbNumber, bookingReference, trackingUrl, rawResponse }
   */
  async createOrder(shipmentData) {
    this._requireCredentials();

    const pickupLocation =
      shipmentData.pickupLocation || this.pickupLocationName;
    if (!pickupLocation) {
      throw Object.assign(
        new Error(
          "Delhivery B2B requires a registered pickup location name (pickupLocationName) matching the warehouse configured in Delhivery One",
        ),
        { code: "DELHIVERY_B2B_CONFIG_MISSING", statusCode: 400 },
      );
    }

    const isCod = shipmentData.paymentType === "COD";
    const declaredValue =
      Number(shipmentData.declaredValue) || Number(shipmentData.codAmount) || 0;

    const manifestPayload = {
      pickup_location: pickupLocation,
      dropoff_location: {
        consignee: shipmentData.deliveryAddress.name,
        address: shipmentData.deliveryAddress.address,
        city: shipmentData.deliveryAddress.city,
        region: shipmentData.deliveryAddress.state,
        zip: String(shipmentData.deliveryAddress.pincode),
        phone: shipmentData.deliveryAddress.phone,
        ...(shipmentData.deliveryAddress.email && {
          email: shipmentData.deliveryAddress.email,
        }),
      },
      // d_mode enum is case-sensitive: "Prepaid" | "CoD"; amount must be 0 for Prepaid
      d_mode: isCod ? "CoD" : "Prepaid",
      amount: isCod ? Number(shipmentData.codAmount) || 0 : 0,
      invoices: [
        {
          ident: String(shipmentData.orderId),
          n_value: declaredValue,
          ...(shipmentData.ewaybill && { ewaybill: shipmentData.ewaybill }),
        },
      ],
      // B2B manifest weight is in GRAMS (booking payload weight is kg)
      weight: Math.round(
        (Number(shipmentData.packageDetails.weight) || 0) * 1000,
      ),
      suborders: [
        {
          ident: String(shipmentData.orderId),
          count: Number(shipmentData.packageDetails.boxCount) || 1,
          description: shipmentData.productDescription || "Package",
        },
      ],
      ...(shipmentData.packageDetails.length &&
        shipmentData.packageDetails.width &&
        shipmentData.packageDetails.height && {
          dimensions: [
            {
              length: Number(shipmentData.packageDetails.length),
              width: Number(shipmentData.packageDetails.width),
              height: Number(shipmentData.packageDetails.height),
              count: Number(shipmentData.packageDetails.boxCount) || 1,
            },
          ],
        }),
      ...(shipmentData.consigneeGstTin && {
        consignee_gst_tin: shipmentData.consigneeGstTin,
      }),
      ...(shipmentData.sellerGstTin && {
        seller_gst_tin: shipmentData.sellerGstTin,
      }),
    };

    logger.info("Creating Delhivery B2B manifest", {
      orderId: shipmentData.orderId,
      pickupLocation,
      dMode: manifestPayload.d_mode,
      weightGrams: manifestPayload.weight,
    });

    const submitResponse = await this.makeAuthenticatedRequest({
      method: "POST",
      url: "/v2/manifest",
      headers: { "Content-Type": "application/json" },
      data: manifestPayload,
    });

    const jobId = submitResponse?.job_id;
    if (!jobId) {
      logger.error("Delhivery B2B manifest submission returned no job_id", {
        orderId: shipmentData.orderId,
        response: submitResponse,
      });
      return {
        success: false,
        awbNumber: null,
        bookingReference: null,
        trackingUrl: null,
        estimatedDelivery: null,
        rawResponse: submitResponse,
      };
    }

    const jobResult = await this._pollManifestJob(jobId, shipmentData.orderId);
    const lrNumber = jobResult?.status?.value?.lrnum || null;

    if (!lrNumber) {
      const failureType = jobResult?.status?.value;
      const reason =
        jobResult?.status?.reason ||
        (typeof failureType === "string" ? failureType : null) ||
        "Delhivery B2B manifest did not return an LR number";
      logger.error("Delhivery B2B manifest job failed", {
        orderId: shipmentData.orderId,
        jobId,
        failureType,
        reason,
      });
      return {
        success: false,
        awbNumber: null,
        bookingReference: jobId,
        trackingUrl: null,
        estimatedDelivery: null,
        rawResponse: { submit: submitResponse, job: jobResult, rmk: reason },
      };
    }

    logger.info("Delhivery B2B manifest complete", {
      orderId: shipmentData.orderId,
      jobId,
      lrNumber,
    });

    return {
      success: true,
      awbNumber: lrNumber, // LR number is the B2B shipment identifier
      bookingReference: jobId,
      trackingUrl: null,
      estimatedDelivery: null,
      rawResponse: { submit: submitResponse, job: jobResult },
    };
  }

  /**
   * Poll the async manifest job until Complete or attempts are exhausted.
   * @param {string} jobId
   * @param {string} orderId - for logging
   * @returns {Promise<Object>} final job payload
   * @private
   */
  async _pollManifestJob(jobId, orderId) {
    let lastResult = null;

    for (let attempt = 1; attempt <= MANIFEST_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) =>
        setTimeout(resolve, MANIFEST_POLL_DELAY_MS),
      );

      lastResult = await this.makeAuthenticatedRequest({
        method: "GET",
        url: `/v2/manifest?job_id=${encodeURIComponent(jobId)}`,
      });

      const statusType = lastResult?.status?.type;
      logger.info("Delhivery B2B manifest job poll", {
        orderId,
        jobId,
        attempt,
        statusType,
      });

      if (statusType === "Complete") {
        return lastResult;
      }
    }

    logger.warn("Delhivery B2B manifest job polling exhausted", {
      orderId,
      jobId,
      attempts: MANIFEST_POLL_ATTEMPTS,
    });
    return lastResult;
  }

  /**
   * Delhivery B2B exposes no cancellation API — cancellations go through the
   * Delhivery One portal / account manager.
   */
  async cancelOrder(awbNumber) {
    throw Object.assign(
      new Error(
        `Delhivery B2B (LTL) shipments cannot be cancelled via API. Cancel LR ${awbNumber} through the Delhivery One portal or your account manager.`,
      ),
      { code: "PROVIDER_CANCEL_UNSUPPORTED", statusCode: 400 },
    );
  }

  /**
   * Track a B2B shipment by LR number. Freight tracking is LR-level milestones
   * (coarser than B2C per-waybill scans).
   * @param {string} awbNumber - LR number
   */
  async trackShipment(awbNumber) {
    const cacheKey = `courier:delhivery_b2b:track:${awbNumber}`;

    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached Delhivery B2B tracking", { awbNumber });
      return cached;
    }

    logger.info("Tracking Delhivery B2B shipment", { awbNumber });

    const response = await this.makeAuthenticatedRequest({
      method: "GET",
      url: `/v2/track/${encodeURIComponent(awbNumber)}`,
    });

    const rawStatus = response?.status || "Unknown";
    const result = {
      success: !!response,
      awbNumber,
      currentStatus: this.normalizeStatus(rawStatus),
      currentLocation: response?.location || null,
      events: this.normalizeTrackingEvents([response]),
      estimatedDelivery: null,
      boxCount: response?.count ?? null,
      rawResponse: response,
    };

    await this.setCachedResponse(cacheKey, result, 300);
    return result;
  }

  /**
   * Pickup scheduling is handled during B2B manifestation/warehouse setup —
   * no separate pickup-request API in the LTL spec.
   */
  async requestPickup() {
    throw Object.assign(
      new Error(
        "Delhivery B2B does not expose a pickup-request API; pickups are arranged via Delhivery One",
      ),
      { code: "PROVIDER_PICKUP_UNSUPPORTED", statusCode: 400 },
    );
  }

  /**
   * Get label URLs for an LR (one per box).
   * @param {string} awbNumber - LR number
   * @param {string} [format] - a4 (default) | md | sm — mapped from generic formats
   */
  async getLabel(awbNumber, format) {
    const sizeMap = {
      A4: "a4",
      A4_4: "a4",
      "4x6": "sm",
      "6x4": "sm",
      pdf: "a4",
    };
    const size = sizeMap[format] || this.config.labelSize || "a4";

    logger.info("Fetching Delhivery B2B label URLs", { awbNumber, size });

    const response = await this.makeAuthenticatedRequest({
      method: "GET",
      url: `/v2/get-label-urls/${size}/${encodeURIComponent(awbNumber)}`,
    });

    const urls = Array.isArray(response) ? response : response?.data || [];

    return {
      success: urls.length > 0,
      awbNumber,
      labelData: urls[0] || null,
      labelUrls: urls,
      format: "url",
      rawResponse: response,
    };
  }

  /**
   * B2B manifestation IS the booking step (one LR = one multi-box consignment),
   * so a separate multi-AWB manifest API does not exist.
   */
  async generateManifest() {
    throw Object.assign(
      new Error(
        "Delhivery B2B manifests are created per-LR at booking time; no separate manifest API",
      ),
      { code: "PROVIDER_MANIFEST_UNSUPPORTED", statusCode: 400 },
    );
  }

  /**
   * Check B2B pincode serviceability via the LTL host.
   * Response schema is defensive-parsed (exact shape is behind the gated
   * developer portal — validate during UAT).
   * @param {string} pincode
   */
  async checkPincodeServiceability(pincode) {
    const cacheKey = `courier:delhivery_b2b:pincode:${pincode}`;

    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      logger.info("Returning cached Delhivery B2B pincode serviceability", {
        pincode,
      });
      return cached;
    }

    logger.info("Checking Delhivery B2B pincode serviceability", { pincode });

    const response = await this.makeAuthenticatedRequest({
      method: "GET",
      // Absolute URL — serviceability lives on the LTL host, not the booking host
      url: `${this.ltlApiUrl}/pincode-service/${encodeURIComponent(pincode)}`,
    });

    const data = response?.data ?? response;
    const isServiceable =
      response?.success === true ||
      data?.serviceable === true ||
      data?.is_serviceable === true ||
      (Array.isArray(data) && data.length > 0);

    const result = {
      success: true,
      pincode,
      isServiceable: !!isServiceable,
      deliveryDays: data?.tat || data?.delivery_days || null,
      prepaidAvailable: !!isServiceable,
      codAvailable: data?.cod === true || data?.cod === "Y" || !!isServiceable,
      rawResponse: response,
    };

    await this.setCachedResponse(cacheKey, result, 86400);
    return result;
  }

  /**
   * Normalize B2B freight milestone status to internal status
   * @param {string} courierStatus
   * @returns {string}
   */
  normalizeStatus(courierStatus) {
    const status = String(courierStatus || "").toLowerCase();

    if (status.includes("cancel")) return "CANCELLED";
    if (status.includes("deliver")) return "DELIVERED";
    if (status.includes("rto") || status.includes("return")) return "RTO";
    if (status.includes("out for delivery")) return "OUT_FOR_DELIVERY";
    if (
      status.includes("transit") ||
      status.includes("dispatch") ||
      status.includes("picked")
    ) {
      return "IN_TRANSIT";
    }
    if (status.includes("manifest") || status.includes("booked")) {
      return "BOOKED";
    }
    if (status.includes("pending") || status.includes("created")) {
      return "CREATED";
    }

    return "IN_TRANSIT";
  }

  /**
   * Normalize LR-level tracking snapshots to internal event format
   * @param {Array} events - raw track responses
   * @returns {Array}
   */
  normalizeTrackingEvents(events) {
    if (!Array.isArray(events)) return [];

    return events.filter(Boolean).map((event) => ({
      status: this.normalizeStatus(event.status),
      message: event.status || "",
      location: event.location || "",
      timestamp: event.timestamp || null,
      source: "PARTNER",
      metadata: {
        courierName: "Delhivery B2B",
        rawStatus: event.status || "",
        boxCount: event.count ?? null,
      },
    }));
  }

  getCapabilities() {
    return {
      track: {
        supported: true,
        requiresAwb: true,
        description: "Track LR via Delhivery B2B API",
      },
      label: {
        supported: true,
        requiresAwb: true,
        description: "Get per-box label URLs for an LR",
      },
      cancel: {
        supported: false,
        requiresAwb: true,
        description:
          "No B2B cancel API — use Delhivery One portal / account manager",
      },
      pickup: {
        supported: false,
        requiresAwb: false,
        description: "Pickups arranged via Delhivery One (no API)",
      },
      manifest: {
        supported: false,
        requiresAwb: true,
        description: "Manifestation happens at booking (per-LR)",
      },
      edit: {
        supported: false,
        requiresAwb: true,
        description: "Only invoice/e-waybill edits supported (not wired yet)",
      },
      ndr: {
        supported: false,
        requiresAwb: true,
        description: "NDR not exposed by B2B API",
      },
      ewaybill: {
        supported: false,
        requiresAwb: true,
        description: "Invoice/e-waybill edit endpoint not wired yet",
      },
      pod: {
        supported: true,
        requiresAwb: true,
        allowedStatuses: ["DELIVERED"],
        description: "Proof-of-delivery links via /v2/pod/{lrnum}",
      },
      invoice: {
        supported: false,
        requiresAwb: true,
        description: "Courier invoice not available via API",
      },
      refresh: {
        supported: true,
        requiresAwb: true,
        description: "Fetch latest LR status from Delhivery B2B",
      },
      webhook: {
        supported: false,
        requiresAwb: false,
        description: "No inbound webhook wired for B2B",
      },
    };
  }
}

module.exports = DelhiveryB2BAdapter;
