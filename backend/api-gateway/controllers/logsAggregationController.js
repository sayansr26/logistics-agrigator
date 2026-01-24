/**
 * Logs Aggregation Controller for API Gateway
 * Aggregates audit and runtime logs from all backend services
 */

const { LogCursor, PaginatedLogsResponse } = require("../shared/dtos/logsDto");
const { mergeAuditLogs } = require("../shared/utils/logsUtils");
const logger = require("../shared/lib/logger");

// Service URLs from environment
const SERVICES = {
  "auth-service": process.env.AUTH_SERVICE_URL || "http://auth-service:3002",
  "user-service": process.env.USER_SERVICE_URL || "http://user-service:3003",
  "shipment-service":
    process.env.SHIPMENT_SERVICE_URL || "http://shipment-service:3004",
  "partner-service":
    process.env.PARTNER_SERVICE_URL || "http://partner-service:3005",
  "wallet-service":
    process.env.WALLET_SERVICE_URL || "http://wallet-service:3006",
  "support-service":
    process.env.SUPPORT_SERVICE_URL || "http://support-service:3007",
  "platform-service":
    process.env.PLATFORM_SERVICE_URL || "http://platform-service:3008",
  "license-service":
    process.env.LICENSE_SERVICE_URL || "http://license-service:3009",
};

/**
 * Helper to make authenticated internal request to a service
 */
async function fetchFromService(serviceName, endpoint, req) {
  const serviceUrl = SERVICES[serviceName];
  if (!serviceUrl) {
    logger.warn(`Service URL not configured for ${serviceName}`);
    return null;
  }

  // Map Gateway routes to service routes
  const routeMap = {
    "license-service": "/api/v1/admin/logs",
    "auth-service": "/api/v1/admin",
    "user-service": "/api/v1/admin",
    "shipment-service": "/api/v1/admin",
    "partner-service": "/api/v1/admin",
    "wallet-service": "/api/v1/admin",
    "support-service": "/api/v1/admin",
    "platform-service": "/api/v1/admin",
  };

  const adminRoute = routeMap[serviceName] || "/api/v1/admin";
  const url = `${serviceUrl}${adminRoute}${endpoint}`;

  try {
    const queryParams = new URLSearchParams();
    // Forward relevant query params
    const paramsToForward = [
      "limit",
      "cursor",
      "startDate",
      "endDate",
      "action",
      "resource",
      "userId",
      "clientId",
      "search",
      "file",
      "level",
    ];
    for (const param of paramsToForward) {
      if (req.query[param]) {
        queryParams.append(param, req.query[param]);
      }
    }

    const queryString = queryParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        Authorization: req.headers.authorization,
        "X-Internal-Request": process.env.INTERNAL_SECRET,
        "x-user-id": req.user.userId,
        "x-user-role": req.user.role,
        ...(req.user.clientId && { "x-user-client-id": req.user.clientId }),
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch from ${serviceName}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error(`Error fetching from ${serviceName}:`, error);
    return null;
  }
}

class LogsAggregationController {
  /**
   * GET /admin/audit-logs
   * Aggregates audit logs from all services (superadmin only)
   */
  static async getAdminAuditLogs(req, res) {
    try {
      const { limit = 200, service } = req.query;

      // If specific service requested, fetch only from that service
      if (service && SERVICES[service]) {
        const serviceData = await fetchFromService(service, "/audit-logs", req);
        if (!serviceData) {
          return res.status(503).json({
            status: "error",
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: `${service} is currently unavailable`,
            },
            meta: {
              timestamp: new Date().toISOString(),
            },
          });
        }

        return res.json(serviceData);
      }

      // Fetch from all services in parallel
      const serviceNames = Object.keys(SERVICES);
      const servicePromises = serviceNames.map((serviceName) =>
        fetchFromService(serviceName, "/audit-logs", req),
      );

      const results = await Promise.allSettled(servicePromises);

      // Collect all logs from each service
      const allLogs = {};
      for (let i = 0; i < serviceNames.length; i++) {
        const serviceName = serviceNames[i];
        const result = results[i];

        if (result.status === "fulfilled" && result.value) {
          allLogs[serviceName] = result.value.data || [];
        } else {
          allLogs[serviceName] = [];
        }
      }

      // Merge and paginate logs across all services
      const merged = mergeAuditLogs(allLogs, parseInt(limit));

      res.json({
        status: "success",
        data: merged.logs,
        pagination: merged.pagination,
        meta: {
          gateway: true,
          timestamp: new Date().toISOString(),
          servicesQueried: serviceNames.length,
        },
      });
    } catch (error) {
      logger.error("Error aggregating admin audit logs:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to aggregate audit logs",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * GET /admin/runtime-logs
   * Aggregates runtime logs from all services (superadmin only)
   */
  static async getAdminRuntimeLogs(req, res) {
    try {
      const { service, file, level, limit = 200 } = req.query;

      // If specific service requested, fetch only from that service
      if (service && SERVICES[service]) {
        const serviceData = await fetchFromService(
          service,
          "/runtime-logs",
          req,
        );
        if (!serviceData) {
          return res.status(503).json({
            status: "error",
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: `${service} is currently unavailable`,
            },
            meta: {
              timestamp: new Date().toISOString(),
            },
          });
        }

        return res.json(serviceData);
      }

      // Fetch from all services in parallel
      const serviceNames = Object.keys(SERVICES);
      const servicePromises = serviceNames.map((serviceName) =>
        fetchFromService(serviceName, "/runtime-logs", req),
      );

      const results = await Promise.allSettled(servicePromises);

      // Collect all runtime logs from each service
      const allLogs = {};
      const serviceStatus = {};

      for (let i = 0; i < serviceNames.length; i++) {
        const serviceName = serviceNames[i];
        const result = results[i];

        if (result.status === "fulfilled" && result.value) {
          allLogs[serviceName] = result.value.data || [];
          serviceStatus[serviceName] = {
            available: true,
            availableFiles: result.value.meta?.availableFiles || [],
            file: result.value.meta?.file || null,
          };
        } else {
          allLogs[serviceName] = [];
          serviceStatus[serviceName] = { available: false };
        }
      }

      // Flatten logs for response (maintain service separation)
      const logsByService = Object.entries(allLogs).map(
        ([serviceName, logs]) => ({
          service: serviceName,
          logs,
          ...serviceStatus[serviceName],
        }),
      );

      res.json({
        status: "success",
        data: logsByService,
        meta: {
          gateway: true,
          timestamp: new Date().toISOString(),
          servicesQueried: serviceNames.length,
        },
      });
    } catch (error) {
      logger.error("Error aggregating admin runtime logs:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to aggregate runtime logs",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * GET /audit-logs
   * Client-scoped audit logs (forces clientId filter)
   */
  static async getClientAuditLogs(req, res) {
    try {
      const {
        limit = 200,
        service,
        startDate,
        endDate,
        action,
        resource,
        userId,
        search,
      } = req.query;

      // Superadmin should use /admin/audit-logs endpoint instead
      if (req.user.role === "superadmin") {
        return res.status(400).json({
          status: "error",
          error: {
            code: "USE_ADMIN_ENDPOINT",
            message:
              "Superadmin users should use /admin/audit-logs endpoint for system-wide logs",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Force clientId filter for non-superadmin users
      const clientId = req.user.clientId;
      if (!clientId) {
        return res.status(403).json({
          status: "error",
          error: {
            code: "FORBIDDEN",
            message: "Client ID required for accessing audit logs",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // If specific service requested, fetch only from that service
      if (service && SERVICES[service]) {
        const queryParams = new URLSearchParams();
        queryParams.append("clientId", clientId);
        if (limit) queryParams.append("limit", limit);
        if (startDate) queryParams.append("startDate", startDate);
        if (endDate) queryParams.append("endDate", endDate);
        if (action) queryParams.append("action", action);
        if (resource) queryParams.append("resource", resource);
        if (userId) queryParams.append("userId", userId);
        if (search) queryParams.append("search", search);

        const url = `${SERVICES[service]}/api/v1/admin/audit-logs?${queryParams}`;

        const response = await fetch(url, {
          headers: {
            Authorization: req.headers.authorization,
            "X-Internal-Request": process.env.INTERNAL_SECRET,
            "X-User-Id": req.user.userId,
            "X-User-Role": req.user.role,
            "X-User-Client-Id": clientId,
          },
        });

        if (!response.ok) {
          return res.status(503).json({
            status: "error",
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: `${service} is currently unavailable`,
            },
            meta: {
              timestamp: new Date().toISOString(),
            },
          });
        }

        const serviceData = await response.json();
        return res.json(serviceData);
      }

      // For client access, we only query services that have clientId in their AuditLog model
      // Based on schema analysis: user-service, wallet-service have clientId
      const clientAwareServices = ["user-service", "wallet-service"];

      // Fetch from client-aware services in parallel
      const servicePromises = clientAwareServices.map((serviceName) =>
        fetchFromService(serviceName, "/audit-logs", {
          ...req,
          query: { ...req.query, clientId },
        }),
      );

      const results = await Promise.allSettled(servicePromises);

      // Collect all logs
      const allLogs = {};
      for (let i = 0; i < clientAwareServices.length; i++) {
        const serviceName = clientAwareServices[i];
        const result = results[i];

        if (result.status === "fulfilled" && result.value) {
          allLogs[serviceName] = result.value.data || [];
        } else {
          allLogs[serviceName] = [];
        }
      }

      // Merge and paginate logs
      const merged = mergeAuditLogs(allLogs, parseInt(limit));

      res.json({
        status: "success",
        data: merged.logs,
        pagination: merged.pagination,
        meta: {
          gateway: true,
          timestamp: new Date().toISOString(),
          clientId,
          servicesQueried: clientAwareServices.length,
        },
      });
    } catch (error) {
      logger.error("Error aggregating client audit logs:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to aggregate audit logs",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * GET /audit-log-actions
   * Returns all available audit log action types for filtering
   * Provides categorized action lists for frontend dropdowns
   */
  static async getAvailableActions(req, res) {
    try {
      const auditActions = require("../shared/constants/auditActions");

      // Get all unique action values
      const allActions = auditActions.getAllActions();

      // Get categorized actions
      const categories = auditActions.ACTION_CATEGORIES;

      res.json({
        status: "success",
        data: {
          actions: categories,
          allActions,
          meta: {
            totalActions: allActions.length,
            totalCategories: Object.keys(categories).length,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error("Error getting available audit actions:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve available audit actions",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

module.exports = LogsAggregationController;
