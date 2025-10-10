// Use shared Redis utilities
const { createClient, getClient } = require("../shared/lib/redis");

// Initialize Redis client on module load
let redisClient = null;

const connectRedis = async () => {
  try {
    if (!redisClient) {
      const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
      redisClient = await createClient(redisUrl);
      console.log("User Service: Redis client connected");
    }
    return redisClient;
  } catch (error) {
    console.error("User Service: Redis connection failed:", error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    // Try to get existing client from shared library
    try {
      return getClient();
    } catch (error) {
      throw new Error(
        "Redis client not initialized. Call connectRedis() first.",
      );
    }
  }
  return redisClient;
};

const disconnectRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
      console.log("User Service: Redis disconnected");
    }
  } catch (error) {
    console.error("User Service: Error disconnecting from Redis:", error);
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
};
