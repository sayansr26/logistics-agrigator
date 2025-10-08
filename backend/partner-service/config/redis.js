const redisUtils = require("../shared/lib/redis");

let client;

const connectRedis = async () => {
  try {
    client = await redisUtils.createClient(process.env.REDIS_URL);
    console.log("Redis connected");
    return client;
  } catch (error) {
    console.error("Redis connection failed:", error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!client) {
    console.warn("Redis client not initialized, returning null");
    return null;
  }
  return client;
};

module.exports = {
  connectRedis,
  getRedisClient,
};
