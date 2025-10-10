/**
 * License Service Integration Client
 *
 * Integrates with the license-service to generate and manage licenses
 * for new client registrations.
 */

const axios = require("axios");
const logger = require("../shared/lib/logger");
const { APIError } = require("../shared/lib/errors");

const LICENSE_SERVICE_URL =
  process.env.LICENSE_SERVICE_URL || "http://license-service:3011";
const REQUEST_TIMEOUT = 30000; // 30 seconds

class LicenseServiceClient {
  constructor() {
    this.baseURL = LICENSE_SERVICE_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info("License Service Request", {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL,
        });
        return config;
      },
      (error) => {
        logger.error("License Service Request Error", { error: error.message });
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info("License Service Response", {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error("License Service Response Error", {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Generate a new license for a client
   *
   * @param {Object} licenseData - License generation data
   * @param {string} licenseData.clientId - Client UUID
   * @param {string} licenseData.type - License type (TRIAL, STANDARD, PROFESSIONAL, ENTERPRISE)
   * @param {string} licenseData.plan - Billing plan (MONTHLY, QUARTERLY, YEARLY, LIFETIME)
   * @param {Array<string>} licenseData.allowedServices - Services allowed for this license
   * @param {number} licenseData.maxActivations - Maximum number of activations allowed
   * @param {number} licenseData.validityDays - Validity period in days
   * @param {Object} licenseData.features - Feature flags
   * @param {Object} licenseData.limits - Resource limits
   * @param {string} [authToken] - Optional JWT token for authentication
   * @returns {Promise<Object>} Generated license details
   */
  async generateLicense(licenseData, authToken = null) {
    try {
      const {
        clientId,
        type = "STANDARD",
        plan = "MONTHLY",
        allowedServices = ["auth-service", "user-service", "api-gateway"],
        maxActivations = 1,
        validityDays = 30,
        features = {},
        limits = {},
      } = licenseData;

      // Validate required fields
      if (!clientId) {
        throw new APIError("Client ID is required for license generation", 400);
      }

      // Prepare request headers
      const headers = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      // Call license service generate endpoint
      const response = await this.client.post(
        "/api/v1/licenses/generate",
        {
          clientId,
          type,
          plan,
          allowedServices,
          maxActivations,
          validityDays,
          features,
          limits,
        },
        { headers },
      );

      // Extract license data from response
      const license = response.data?.data?.license || response.data?.license;

      if (!license) {
        throw new APIError("Invalid response from license service", 500);
      }

      logger.info("License generated successfully", {
        clientId,
        licenseId: license.id,
        type,
        plan,
      });

      return {
        id: license.id,
        key: license.key,
        type: license.type,
        plan: license.plan,
        validFrom: license.validFrom,
        validUntil: license.validUntil,
        maxActivations: license.maxActivations,
        allowedServices: license.allowedServices,
        status: license.status || "INACTIVE",
      };
    } catch (error) {
      logger.error("Failed to generate license", {
        clientId: licenseData.clientId,
        error: error.message,
        response: error.response?.data,
      });

      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const message =
          error.response.data?.error?.message ||
          error.response.data?.message ||
          "License generation failed";

        if (status === 400) {
          throw new APIError(`License validation error: ${message}`, 400);
        } else if (status === 401 || status === 403) {
          throw new APIError("Unauthorized to generate license", status);
        } else if (status >= 500) {
          throw new APIError("License service is temporarily unavailable", 503);
        }
      }

      // Network or timeout errors
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        throw new APIError("License service is not available", 503);
      }

      // Re-throw if already an API Error
      if (error instanceof APIError) {
        throw error;
      }

      // Unknown error
      throw new APIError(`License generation failed: ${error.message}`, 500);
    }
  }

  /**
   * Validate a license key
   *
   * @param {string} licenseKey - License key to validate
   * @param {string} machineId - Machine ID for validation
   * @param {string} serverIP - Server IP for validation
   * @returns {Promise<Object>} Validation result
   */
  async validateLicense(licenseKey, machineId = null, serverIP = null) {
    try {
      const response = await this.client.post("/api/v1/licenses/validate", {
        licenseKey,
        machineId,
        serverIP,
      });

      return response.data?.data || response.data;
    } catch (error) {
      logger.error("License validation failed", {
        error: error.message,
        response: error.response?.data,
      });

      if (error.response?.status === 403) {
        throw new APIError("License is invalid or expired", 403);
      }

      throw new APIError("License validation failed", 500);
    }
  }

  /**
   * Get license details by ID
   *
   * @param {string} licenseId - License ID
   * @param {string} [authToken] - Optional JWT token for authentication
   * @returns {Promise<Object>} License details
   */
  async getLicenseDetails(licenseId, authToken = null) {
    try {
      const headers = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await this.client.get(`/api/v1/licenses/${licenseId}`, {
        headers,
      });

      return response.data?.data || response.data;
    } catch (error) {
      logger.error("Failed to get license details", {
        licenseId,
        error: error.message,
      });

      if (error.response?.status === 404) {
        throw new APIError("License not found", 404);
      }

      throw new APIError("Failed to retrieve license details", 500);
    }
  }

  /**
   * Extend license validity
   *
   * @param {string} licenseId - License ID
   * @param {number} days - Number of days to extend
   * @param {string} [authToken] - Optional JWT token for authentication
   * @returns {Promise<Object>} Updated license
   */
  async extendLicense(licenseId, days = 30, authToken = null) {
    try {
      const headers = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await this.client.put(
        `/api/v1/licenses/${licenseId}/extend`,
        { days },
        { headers },
      );

      logger.info("License extended successfully", { licenseId, days });

      return response.data?.data?.license || response.data?.license;
    } catch (error) {
      logger.error("Failed to extend license", {
        licenseId,
        error: error.message,
      });

      throw new APIError("Failed to extend license", 500);
    }
  }

  /**
   * Revoke a license
   *
   * @param {string} licenseId - License ID
   * @param {string} reason - Reason for revocation
   * @param {string} [authToken] - Optional JWT token for authentication
   * @returns {Promise<Object>} Revocation result
   */
  async revokeLicense(licenseId, reason, authToken = null) {
    try {
      const headers = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await this.client.post(
        `/api/v1/licenses/${licenseId}/revoke`,
        { reason },
        { headers },
      );

      logger.info("License revoked successfully", { licenseId, reason });

      return response.data?.data || response.data;
    } catch (error) {
      logger.error("Failed to revoke license", {
        licenseId,
        error: error.message,
      });

      throw new APIError("Failed to revoke license", 500);
    }
  }

  /**
   * Check license service health
   *
   * @returns {Promise<boolean>} Health status
   */
  async checkHealth() {
    try {
      const response = await this.client.get("/health");
      return response.status === 200 && response.data?.status === "ok";
    } catch (error) {
      logger.error("License service health check failed", {
        error: error.message,
      });
      return false;
    }
  }
}

// Export singleton instance
module.exports = new LicenseServiceClient();
