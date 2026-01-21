/**
 * Shared Admin Logs Helper
 * Provides reusable controller methods for services to implement admin log endpoints
 * Each service only needs to provide their prisma instance and service name
 */

const {
  AuditEventDTO,
  RuntimeLogLineDTO,
  LogCursor,
} = require("../dtos/logsDto");
const {
  readLogFile,
  listLogFiles,
  redactLogLines,
  extractNextCursor,
} = require("./logsUtils");

/**
 * Create admin logs controller for a service
 * @param {Object} prisma - Prisma client instance
 * @param {string} serviceName - Service name (e.g., "shipment-service")
 * @param {Object} options - Configuration options
 */
function createAdminLogsController(prisma, serviceName, options = {}) {
  const {
    // Field name for timestamp in AuditLog (default: "createdAt")
    timestampField = "createdAt",
    // Whether service has AuditLog model
    hasAuditLog = true,
    // Custom field mappings for DTO conversion
    fieldMappings = {},
  } = options;

  return {
    /**
     * GET /admin/audit-logs
     * Get audit logs from database with cursor pagination
     */
    async getAuditLogs(req, res) {
      // If service doesn't have AuditLog model, return empty
      if (!hasAuditLog) {
        return res.json({
          status: "success",
          data: [],
          pagination: {
            nextCursor: null,
            hasMore: false,
          },
          meta: {
            service: serviceName,
            message: "Audit logs not enabled for this service",
            timestamp: new Date().toISOString(),
          },
        });
      }

      try {
        const {
          limit = 200,
          cursor,
          startDate,
          endDate,
          action,
          resource,
          userId,
          clientId,
          search,
        } = req.query;

        // Decode cursor if provided
        const serviceCursor = cursor
          ? LogCursor.decode(cursor).getCursor(serviceName)
          : null;

        // Parse cursor for pagination
        let parsedCursor = null;
        if (serviceCursor) {
          parsedCursor = LogCursor.parseTimestampCursor(serviceCursor);
        }

        // Build Prisma query with filters
        const where = {};
        if (startDate || endDate) {
          where[timestampField] = {};
          if (startDate) where[timestampField].gte = new Date(startDate);
          if (endDate) where[timestampField].lte = new Date(endDate);
        }
        if (action) where.action = action;
        if (resource) {
          // Handle different field names for resource
          where.resource = resource;
          if (fieldMappings.resourceType) {
            where[fieldMappings.resourceType] = resource;
          }
        }
        if (userId) where.userId = userId;
        if (clientId && fieldMappings.clientId) {
          where[fieldMappings.clientId] = clientId;
        }
        if (search) {
          where.OR = [
            { action: { contains: search, mode: "insensitive" } },
            { resource: { contains: search, mode: "insensitive" } },
          ];
        }

        const take = Math.min(parseInt(limit), 500);
        const query = {
          where,
          take,
          orderBy: { [timestampField]: "desc" },
        };

        // Add cursor pagination
        if (parsedCursor && parsedCursor.timestamp) {
          query.cursor = {
            [timestampField]: parsedCursor.timestamp,
            id: parsedCursor.id,
          };
          query.skip = 1;
        }

        // Fetch audit logs
        const logs = await prisma.auditLog.findMany(query);

        // Convert to DTOs
        const auditEvents = logs.map((log) =>
          AuditEventDTO.fromGenericService(serviceName, log).toJSON(),
        );

        // Extract next cursor
        const nextCursorData = extractNextCursor(logs, timestampField);
        let nextCursor = null;
        if (nextCursorData) {
          const gatewayCursor = new LogCursor();
          gatewayCursor.setCursor(
            serviceName,
            LogCursor.createTimestampCursor(
              nextCursorData.timestamp,
              nextCursorData.id,
            ),
          );
          nextCursor = gatewayCursor.encode();
        }

        const hasMore = logs.length === take;

        res.json({
          status: "success",
          data: auditEvents,
          pagination: {
            nextCursor,
            hasMore,
          },
          meta: {
            service: serviceName,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error(`Error fetching ${serviceName} audit logs:`, error);
        res.status(500).json({
          status: "error",
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch audit logs",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    },

    /**
     * GET /admin/runtime-logs
     * Get runtime logs from Winston log files with tail support
     */
    async getRuntimeLogs(req, res) {
      try {
        const { file, level = null, limit = 200, cursor } = req.query;

        const maxLines = Math.min(parseInt(limit), 500);
        const logFiles = listLogFiles(serviceName);

        if (logFiles.length === 0) {
          return res.json({
            status: "success",
            data: [],
            meta: {
              service: serviceName,
              message: "No log files available",
              timestamp: new Date().toISOString(),
            },
          });
        }

        const targetFile = file || logFiles[0];

        const validFilePattern = /^\d{4}-\d{2}-\d{2}(-error)?\.log$/;
        if (!validFilePattern.test(targetFile)) {
          return res.status(400).json({
            status: "error",
            error: {
              code: "INVALID_FILE",
              message:
                "Invalid log file name. Must be in format YYYY-MM-DD.log or YYYY-MM-DD-error.log",
            },
          });
        }

        let startLine = null;
        if (cursor) {
          const serviceCursor = LogCursor.decode(cursor).getCursor(serviceName);
          if (serviceCursor) {
            const parsedCursor = LogCursor.parseRuntimeCursor(serviceCursor);
            if (parsedCursor && parsedCursor.file === targetFile) {
              startLine = parsedCursor.line;
            }
          }
        }

        const result = readLogFile(
          serviceName,
          targetFile,
          maxLines,
          startLine,
        );

        let logLines = result.lines.map((lineData) =>
          RuntimeLogLineDTO.parseLogLine(
            serviceName,
            targetFile,
            lineData.text,
            lineData.line,
          ),
        );

        if (level) {
          logLines = logLines.filter(
            (log) => log.parsed && log.parsed.level === level,
          );
        }

        // Redact sensitive data
        logLines = logLines.map((log) => {
          if (log.raw) {
            log.raw = redactLogLines([{ text: log.raw }])[0].text;
          }
          return log;
        });

        let nextCursor = null;
        if (result.hasMore && result.nextLine) {
          const gatewayCursor = new LogCursor();
          gatewayCursor.setCursor(
            serviceName,
            LogCursor.createRuntimeCursor(targetFile, result.nextLine),
          );
          nextCursor = gatewayCursor.encode();
        }

        res.json({
          status: "success",
          data: logLines.map((log) => log.toJSON()),
          pagination: {
            nextCursor,
            hasMore: result.hasMore,
          },
          meta: {
            service: serviceName,
            file: targetFile,
            availableFiles: logFiles,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error(`Error fetching ${serviceName} runtime logs:`, error);
        res.status(500).json({
          status: "error",
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch runtime logs",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    },

    /**
     * GET /admin/log-files
     * List available log files
     */
    async listLogFiles(req, res) {
      try {
        const logFiles = listLogFiles(serviceName);

        res.json({
          status: "success",
          data: {
            files: logFiles,
            logDirectory: `logs/${serviceName}`,
          },
          meta: {
            service: serviceName,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error(`Error listing ${serviceName} log files:`, error);
        res.status(500).json({
          status: "error",
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to list log files",
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  };
}

module.exports = { createAdminLogsController };
