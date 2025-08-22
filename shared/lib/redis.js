const redis = require("redis");

// Shared Redis utilities
let client;

const redisUtils = {
  // Create Redis connection
  createClient: async (url) => {
    try {
      client = redis.createClient({ url });

      client.on("error", (err) => {
        console.error("Redis Client Error:", err);
      });

      await client.connect();
      console.log("Redis connected");
      return client;
    } catch (error) {
      console.error("Redis connection failed:", error);
      throw error;
    }
  },

  // Get Redis client
  getClient: () => {
    if (!client) {
      throw new Error("Redis client not initialized");
    }
    return client;
  },

  // Set with expiration
  setWithExpiry: async (key, value, expirationInSeconds) => {
    const redisClient = redisUtils.getClient();
    return await redisClient.setEx(
      key,
      expirationInSeconds,
      JSON.stringify(value),
    );
  },

  // Get and parse JSON
  getJSON: async (key) => {
    const redisClient = redisUtils.getClient();
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  },

  // Delete key
  delete: async (key) => {
    const redisClient = redisUtils.getClient();
    return await redisClient.del(key);
  },

  // Check if key exists
  exists: async (key) => {
    const redisClient = redisUtils.getClient();
    return await redisClient.exists(key);
  },

  // Set session
  setSession: async (userId, sessionData, expirationInSeconds = 3600) => {
    return await redisUtils.setWithExpiry(
      `session:${userId}`,
      sessionData,
      expirationInSeconds,
    );
  },

  // Get session
  getSession: async (userId) => {
    return await redisUtils.getJSON(`session:${userId}`);
  },

  // Delete session
  deleteSession: async (userId) => {
    return await redisUtils.delete(`session:${userId}`);
  },
};

module.exports = redisUtils;
