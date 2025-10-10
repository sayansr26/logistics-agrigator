const redis = require('redis');
const logger = require('../shared/lib/logger');

let redisClient;

/**
 * Initialize Redis connection
 */
const initializeRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          logger.info(`Redis: Reconnecting in ${delay}ms...`);
          return delay;
        }
      }
    });

    // Event handlers
    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();

    // Test connection
    await redisClient.ping();

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

/**
 * Get Redis client instance
 */
const getClient = () => {
  if (!redisClient) {
    logger.warn('Redis client not initialized, initializing now...');
    initializeRedis();
  }
  return redisClient;
};

/**
 * License-specific Redis operations
 */
const licenseOps = {
  /**
   * Store license activation data
   */
  async setActivation(licenseKey, activationData, ttl = 3600) {
    const key = `license:activation:${licenseKey}`;
    await redisClient.setEx(key, ttl, JSON.stringify(activationData));
  },

  /**
   * Get license activation data
   */
  async getActivation(licenseKey) {
    const key = `license:activation:${licenseKey}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Store heartbeat data
   */
  async setHeartbeat(machineId, data, ttl = 300) {
    const key = `heartbeat:${machineId}`;
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  },

  /**
   * Get heartbeat data
   */
  async getHeartbeat(machineId) {
    const key = `heartbeat:${machineId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Rate limiting for activation attempts
   */
  async checkRateLimit(identifier, maxAttempts = 5, windowSeconds = 3600) {
    const key = `ratelimit:activation:${identifier}`;
    const current = await redisClient.incr(key);

    if (current === 1) {
      await redisClient.expire(key, windowSeconds);
    }

    return {
      allowed: current <= maxAttempts,
      remaining: Math.max(0, maxAttempts - current),
      resetIn: await redisClient.ttl(key)
    };
  },

  /**
   * Cache license data
   */
  async cacheLicense(licenseId, licenseData, ttl = 600) {
    const key = `license:data:${licenseId}`;
    await redisClient.setEx(key, ttl, JSON.stringify(licenseData));
  },

  /**
   * Get cached license data
   */
  async getCachedLicense(licenseId) {
    const key = `license:data:${licenseId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Invalidate license cache
   */
  async invalidateLicense(licenseId) {
    const key = `license:data:${licenseId}`;
    await redisClient.del(key);
  },

  /**
   * Store session data for admin panel
   */
  async setAdminSession(sessionId, sessionData, ttl = 7200) {
    const key = `admin:session:${sessionId}`;
    await redisClient.setEx(key, ttl, JSON.stringify(sessionData));
  },

  /**
   * Get admin session data
   */
  async getAdminSession(sessionId) {
    const key = `admin:session:${sessionId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }
};

module.exports = {
  initializeRedis,
  getClient,
  licenseOps
};