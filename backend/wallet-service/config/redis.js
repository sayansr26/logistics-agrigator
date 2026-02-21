// Use shared Redis utilities (same pattern as user-service)
const { createClient, getClient } = require("../shared/lib/redis");

let redisClient = null;

const connectRedis = async () => {
  try {
    if (!redisClient) {
      const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
      redisClient = await createClient(redisUrl);
      console.log("Wallet Service: Redis client connected");
    }
    return redisClient;
  } catch (error) {
    console.error("Wallet Service: Redis connection failed:", error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
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
      console.log("Wallet Service: Redis disconnected");
    }
  } catch (error) {
    console.error("Wallet Service: Error disconnecting from Redis:", error);
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
};
