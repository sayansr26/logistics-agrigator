const axios = require("axios");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || "internal-service-secret";

const CACHE_PREFIX = "shipment-outlet-wallet";
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
  } catch (error) {
    logger.warn("Failed to read outlet wallet cache", {
      service: "shipment-service",
      cacheKey,
      error: error.message,
    });
    return null;
  }
}

async function writeCache(cacheKey, value, ttl = CACHE_TTL) {
  const redis = getRedisSafely();
  if (!redis) return;

  try {
    await redis.setEx(cacheKey, ttl, JSON.stringify(value));
  } catch (error) {
    logger.warn("Failed to write outlet wallet cache", {
      service: "shipment-service",
      cacheKey,
      error: error.message,
    });
  }
}

async function fetchOutletWalletContext(url, cacheKey, logContext) {
  const cached = await readCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        "X-Internal-Request": INTERNAL_SECRET,
      },
      timeout: 5000,
    });

    const data = response.data?.data;

    if (!data?.found || !data.phone) {
      await writeCache(cacheKey, null, 60);
      logger.debug("No outlet wallet context found", {
        service: "shipment-service",
        ...logContext,
      });
      return null;
    }

    const result = {
      outletId: data.outletId,
      outletName: data.outletName,
      badge: data.badge,
      phone: data.phone,
      isActive: data.isActive,
    };

    await writeCache(cacheKey, result);

    logger.debug("Resolved outlet wallet context", {
      service: "shipment-service",
      ...logContext,
      outletId: result.outletId,
      phone: result.phone,
    });

    return result;
  } catch (error) {
    logger.warn("Failed to resolve outlet wallet context", {
      service: "shipment-service",
      ...logContext,
      error: error.message,
      status: error.response?.status,
    });
    return null;
  }
}

async function resolveOutletWalletByUserId(userId) {
  if (!userId) return null;

  return fetchOutletWalletContext(
    `${USER_SERVICE_URL}/api/v1/internal/outlets/by-user/${userId}`,
    `${CACHE_PREFIX}:user:${userId}`,
    { userId, lookup: "userId" },
  );
}

async function resolveOutletWalletByOutletId(outletId) {
  if (!outletId) return null;

  return fetchOutletWalletContext(
    `${USER_SERVICE_URL}/api/v1/internal/outlets/${outletId}/badge`,
    `${CACHE_PREFIX}:outlet:${outletId}`,
    { outletId, lookup: "outletId" },
  );
}

module.exports = {
  resolveOutletWalletByUserId,
  resolveOutletWalletByOutletId,
};
