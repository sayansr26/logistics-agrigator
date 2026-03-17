/**
 * Outlet Context Service
 *
 * Resolves outlet badge from user-service for the current user.
 * Calls the internal user-service endpoint with X-Internal-Request header.
 * Caches badge in Redis (short TTL) for performance.
 */

const axios = require("axios");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || "internal-service-secret";

const CACHE_PREFIX = "outlet-badge";
const CACHE_TTL = 300; // 5 minutes

/**
 * Resolve outlet badge for a given userId.
 * Returns null if user has no outlet or badge lookup fails.
 *
 * @param {string} userId
 * @returns {Promise<{ outletId: string, badge: string, outletName: string } | null>}
 */
async function resolveOutletBadge(userId) {
  if (!userId) return null;

  // Check cache first
  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}:${userId}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        logger.debug("Outlet badge cache hit", { userId, badge: parsed.badge });
        return parsed;
      }
    } catch (error) {
      logger.warn("Redis cache read error for outlet badge", {
        error: error.message,
      });
    }
  }

  // Call user-service internal endpoint
  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}/api/v1/internal/outlets/by-user/${userId}`,
      {
        headers: {
          "X-Internal-Request": INTERNAL_SECRET,
        },
        timeout: 5000,
      },
    );

    const data = response.data?.data;

    if (!data || !data.found) {
      logger.debug("No outlet found for userId", { userId });
      // Cache negative result (shorter TTL)
      if (redis) {
        try {
          await redis.setEx(cacheKey, 60, JSON.stringify(null));
        } catch (e) {
          /* ignore cache error */
        }
      }
      return null;
    }

    const result = {
      outletId: data.outletId,
      badge: data.badge,
      outletName: data.outletName,
      isActive: data.isActive,
    };

    // Cache the result
    if (redis) {
      try {
        await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
      } catch (e) {
        logger.warn("Redis cache write error for outlet badge", {
          error: e.message,
        });
      }
    }

    logger.debug("Outlet badge resolved from user-service", {
      userId,
      badge: result.badge,
    });

    return result;
  } catch (error) {
    logger.warn("Failed to resolve outlet badge from user-service", {
      userId,
      error: error.message,
      status: error.response?.status,
    });
    return null;
  }
}

/**
 * Resolve outlet badge by outletId directly.
 * Used when admin/superadmin creates shipment on behalf of an outlet.
 *
 * @param {string} outletId
 * @returns {Promise<{ outletId: string, badge: string, outletName: string } | null>}
 */
async function resolveOutletBadgeById(outletId) {
  if (!outletId) return null;

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}:outlet:${outletId}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        logger.debug("Outlet badge (by ID) cache hit", {
          outletId,
          badge: parsed?.badge,
        });
        return parsed;
      }
    } catch (error) {
      logger.warn("Redis cache read error for outlet badge by ID", {
        error: error.message,
      });
    }
  }

  try {
    const response = await axios.get(
      `${USER_SERVICE_URL}/api/v1/internal/outlets/${outletId}/badge`,
      {
        headers: {
          "X-Internal-Request": INTERNAL_SECRET,
        },
        timeout: 5000,
      },
    );

    const data = response.data?.data;

    if (!data || !data.found) {
      logger.debug("No outlet found for outletId", { outletId });
      if (redis) {
        try {
          await redis.setEx(cacheKey, 60, JSON.stringify(null));
        } catch (e) {
          /* ignore */
        }
      }
      return null;
    }

    const result = {
      outletId: data.outletId,
      badge: data.badge,
      outletName: data.outletName,
      isActive: data.isActive,
    };

    if (redis) {
      try {
        await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
      } catch (e) {
        logger.warn("Redis cache write error for outlet badge by ID", {
          error: e.message,
        });
      }
    }

    logger.debug("Outlet badge resolved by outletId from user-service", {
      outletId,
      badge: result.badge,
    });

    return result;
  } catch (error) {
    logger.warn(
      "Failed to resolve outlet badge by outletId from user-service",
      {
        outletId,
        error: error.message,
        status: error.response?.status,
      },
    );
    return null;
  }
}

module.exports = {
  resolveOutletBadge,
  resolveOutletBadgeById,
};
