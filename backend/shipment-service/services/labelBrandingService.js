/**
 * Label Branding Service
 *
 * Resolves WHO appears as the shipper on a shipping label. Couriers render
 * their own labels under the aggregator's account name (e.g. "LOGIMART
 * TECHNOLOGIES LTD"), which is wrong for a white-label platform — the end
 * customer must see the outlet / client they actually dealt with.
 *
 * Resolution order:
 *   1. Outlet  (shipment.outletId)  → outlet company name / legal details
 *   2. Client  (shipment.clientId)  → tenant company name
 *   3. Pickup contact on the shipment (always available)
 *
 * The result feeds both the platform-rendered label (labelGenerationService)
 * and the `seller_name` / `seller_add` fields sent to the courier at booking.
 */

const axios = require("axios");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || "internal-service-secret";

const CACHE_PREFIX = "shipment-label-branding:v1";
const CACHE_TTL = 300;

function getRedisSafely() {
  try {
    return getRedisClient();
  } catch (_error) {
    return null;
  }
}

async function readCache(cacheKey) {
  const redis = getRedisSafely();
  if (!redis) return null;
  try {
    const cached = await redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (_error) {
    return null;
  }
}

async function writeCache(cacheKey, value, ttl = CACHE_TTL) {
  const redis = getRedisSafely();
  if (!redis) return;
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(value));
  } catch (_error) {
    // Cache is best-effort
  }
}

async function fetchInternal(url, logContext) {
  try {
    const response = await axios.get(url, {
      headers: { "X-Internal-Request": INTERNAL_SECRET },
      timeout: 5000,
    });
    const data = response.data?.data;
    return data?.found === false ? null : data || null;
  } catch (error) {
    logger.warn("Failed to resolve label branding party", {
      service: "shipment-service",
      ...logContext,
      error: error.message,
      status: error.response?.status,
    });
    return null;
  }
}

/**
 * `companyAddress` is a free-form Json column; accept the common shapes.
 */
function parseAddressJson(addressJson) {
  if (!addressJson || typeof addressJson !== "object") return {};
  const a = addressJson;
  return {
    line1: a.line1 || a.addressLine1 || a.address1 || a.address || null,
    line2: a.line2 || a.addressLine2 || a.address2 || null,
    city: a.city || null,
    state: a.state || null,
    pincode: a.pincode || a.pinCode || a.zip || null,
    phone: a.phone || null,
  };
}

function cleanName(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchOutletBranding(outletId) {
  const cacheKey = `${CACHE_PREFIX}:outlet:${outletId}`;
  const cached = await readCache(cacheKey);
  if (cached !== null) return cached;

  const data = await fetchInternal(
    `${USER_SERVICE_URL}/api/v1/internal/outlets/${outletId}/billing-details`,
    { outletId, lookup: "outlet" },
  );

  if (!data) {
    await writeCache(cacheKey, null, 60);
    return null;
  }

  const address = parseAddressJson(data.companyAddress);
  const result = {
    source: "OUTLET",
    brandName: cleanName(data.companyName) || cleanName(data.name),
    legalName: cleanName(data.companyName) || null,
    gstin: cleanName(data.gst) || null,
    address,
  };

  await writeCache(cacheKey, result);
  return result;
}

async function fetchClientBranding(clientId) {
  const cacheKey = `${CACHE_PREFIX}:client:${clientId}`;
  const cached = await readCache(cacheKey);
  if (cached !== null) return cached;

  const data = await fetchInternal(
    `${USER_SERVICE_URL}/api/v1/internal/clients/${clientId}/billing-details`,
    { clientId, lookup: "client" },
  );

  if (!data) {
    await writeCache(cacheKey, null, 60);
    return null;
  }

  const address = parseAddressJson(data.companyAddress || data.address);
  const result = {
    source: "CLIENT",
    brandName:
      cleanName(data.brandName) ||
      cleanName(data.companyName) ||
      cleanName(data.name),
    legalName: cleanName(data.companyName) || null,
    gstin: cleanName(data.gst || data.gstin) || null,
    address,
  };

  await writeCache(cacheKey, result);
  return result;
}

/**
 * Resolve the shipper branding for a shipment.
 *
 * @param {Object} params
 * @param {string|null} params.outletId
 * @param {string|null} params.clientId
 * @param {Object} params.pickup - { name, phone, line1, line2, city, state, pincode }
 * @returns {Promise<{source:string, brandName:string, legalName:?string, gstin:?string, phone:?string, address:Object}>}
 */
async function resolveShipperBranding({ outletId, clientId, pickup = {} }) {
  let party = null;

  if (outletId) {
    party = await fetchOutletBranding(outletId);
  }
  if (!party?.brandName && clientId) {
    party = await fetchClientBranding(clientId);
  }

  const pickupFallback = {
    line1: pickup.line1 || null,
    line2: pickup.line2 || null,
    city: pickup.city || null,
    state: pickup.state || null,
    pincode: pickup.pincode || null,
    phone: pickup.phone || null,
  };

  if (!party?.brandName) {
    return {
      source: "PICKUP_CONTACT",
      brandName: cleanName(pickup.name) || "Shipper",
      legalName: null,
      gstin: null,
      phone: pickup.phone || null,
      address: pickupFallback,
    };
  }

  // A registered company address may be incomplete — the parcel physically
  // returns to the pickup point, so that wins whenever the company one is
  // missing a line or pincode.
  const hasCompanyAddress = party.address?.line1 && party.address?.pincode;

  return {
    ...party,
    phone: party.address?.phone || pickup.phone || null,
    address: hasCompanyAddress ? party.address : pickupFallback,
  };
}

/**
 * Flatten a branding address into the single-line form couriers accept.
 */
function formatAddressLine(address = {}) {
  return [address.line1, address.line2, address.city, address.state]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

module.exports = {
  resolveShipperBranding,
  formatAddressLine,
  parseAddressJson,
};
