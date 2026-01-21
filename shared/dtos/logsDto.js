/**
 * Unified Log DTOs for Audit and Runtime Logs
 * These are the standard contracts returned by all services and consumed by the Gateway
 */

/**
 * Normalized Audit Event DTO
 * Represents a single audit log entry from any service's AuditLog table
 *
 * Service-specific mappings to this DTO:
 * - auth-service: timestamp -> timestamp, userId -> userId, action -> action, resource -> resource
 * - user-service: createdAt -> timestamp, adds clientId, outletId, userProfileId
 * - partner-service: timestamp -> timestamp, action -> action, resourceType -> resource
 * - shipment-service: createdAt -> timestamp
 * - wallet-service: createdAt -> timestamp
 * - license-service: createdAt -> timestamp
 */
class AuditEventDTO {
  constructor(data) {
    this.id = data.id;
    this.service = data.service; // Service name: "auth-service", "user-service", etc.
    this.timestamp = data.timestamp || data.createdAt;
    this.userId = data.userId || null;
    this.clientId = data.clientId || null; // For user-service multi-tenancy
    this.action = data.action; // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    this.resource = data.resource || data.resourceType; // User, Client, Shipment, etc.
    this.resourceId = data.resourceId || null;
    this.ipAddress = data.ipAddress || data.ip || null;
    this.userAgent = data.userAgent || null;
    this.changes = data.changes || data.requestData || null;
    this.metadata = data.metadata || data.responseData || null;
  }

  /**
   * Convert auth-service AuditLog to AuditEventDTO
   */
  static fromAuthService(auditLog) {
    return new AuditEventDTO({
      ...auditLog,
      service: "auth-service",
      timestamp: auditLog.createdAt,
    });
  }

  /**
   * Convert user-service AuditLog to AuditEventDTO
   */
  static fromUserService(auditLog) {
    return new AuditEventDTO({
      ...auditLog,
      service: "user-service",
      timestamp: auditLog.createdAt,
    });
  }

  /**
   * Convert partner-service AuditLog to AuditEventDTO
   */
  static fromPartnerService(auditLog) {
    return new AuditEventDTO({
      id: auditLog.id,
      service: "partner-service",
      timestamp: auditLog.timestamp,
      userId: auditLog.userId,
      action: auditLog.action,
      resource: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      changes: auditLog.requestData,
      metadata: auditLog.responseData,
    });
  }

  /**
   * Generic converter for services with standard AuditLog schema
   */
  static fromGenericService(serviceName, auditLog) {
    return new AuditEventDTO({
      ...auditLog,
      service: serviceName,
      timestamp: auditLog.timestamp || auditLog.createdAt,
    });
  }

  toJSON() {
    return {
      id: this.id,
      service: this.service,
      timestamp: this.timestamp,
      userId: this.userId,
      clientId: this.clientId,
      action: this.action,
      resource: this.resource,
      resourceId: this.resourceId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      changes: this.changes,
      metadata: this.metadata,
    };
  }
}

/**
 * Normalized Runtime Log Line DTO
 * Represents a single line from a Winston log file
 */
class RuntimeLogLineDTO {
  constructor(data) {
    this.service = data.service; // Service name
    this.file = data.file; // Log filename: "2024-01-15.log"
    this.line = data.line; // Line number
    this.parsed = data.parsed || null; // Parsed log data if JSON format
    this.raw = data.raw || null; // Raw log line
  }

  /**
   * Parse a Winston log line
   * Format: [timestamp] level [service] [additional context] message
   */
  static parseLogLine(service, file, lineText, lineNumber) {
    const parsed = {
      timestamp: null,
      level: null,
      message: lineText,
    };

    // Try to parse timestamp from beginning
    const timestampMatch = lineText.match(
      /^\[(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})\]/,
    );
    if (timestampMatch) {
      parsed.timestamp = timestampMatch[1];
    }

    // Try to extract log level
    const levelMatch = lineText.match(/\s+(ERROR|WARN|INFO|DEBUG)\s+/i);
    if (levelMatch) {
      parsed.level = levelMatch[1].toLowerCase();
    }

    // Extract service name if present
    const serviceMatch = lineText.match(/\[([a-z-]+)\]/i);
    if (serviceMatch) {
      parsed.service = serviceMatch[1];
    }

    return new RuntimeLogLineDTO({
      service,
      file,
      line: lineNumber,
      parsed: Object.keys(parsed).length > 1 ? parsed : null,
      raw: lineText,
    });
  }

  toJSON() {
    return {
      service: this.service,
      file: this.file,
      line: this.line,
      parsed: this.parsed,
      raw: this.raw,
    };
  }
}

/**
 * Cursor for pagination
 * Encodes service-specific cursors into a single Gateway cursor
 */
class LogCursor {
  constructor(serviceCursors = {}) {
    this.serviceCursors = serviceCursors;
  }

  /**
   * Encode to base64 for transport
   */
  encode() {
    const json = JSON.stringify(this.serviceCursors);
    return Buffer.from(json).toString("base64");
  }

  /**
   * Decode from base64
   */
  static decode(encoded) {
    if (!encoded) return new LogCursor({});
    try {
      const json = Buffer.from(encoded, "base64").toString("utf-8");
      return new LogCursor(JSON.parse(json));
    } catch (error) {
      return new LogCursor({});
    }
  }

  /**
   * Get cursor for a specific service
   */
  getCursor(service) {
    return this.serviceCursors[service] || null;
  }

  /**
   * Update cursor for a specific service
   */
  setCursor(service, cursor) {
    this.serviceCursors[service] = cursor;
  }

  /**
   * Create timestamp-based cursor for audit logs
   */
  static createTimestampCursor(timestamp, id) {
    return `${timestamp.toISOString()}:${id}`;
  }

  /**
   * Parse timestamp-based cursor
   */
  static parseTimestampCursor(cursor) {
    if (!cursor) return null;
    try {
      const [timestamp, id] = cursor.split(":");
      return {
        timestamp: new Date(timestamp),
        id,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create file-based cursor for runtime logs
   */
  static createRuntimeCursor(file, line) {
    return `${file}:${line}`;
  }

  /**
   * Parse runtime log cursor
   */
  static parseRuntimeCursor(cursor) {
    if (!cursor) return null;
    try {
      const [file, line] = cursor.split(":");
      return { file, line: parseInt(line, 10) };
    } catch (error) {
      return null;
    }
  }
}

/**
 * Paginated response wrapper
 */
class PaginatedLogsResponse {
  constructor(data, nextCursor, hasMore) {
    this.data = data;
    this.pagination = {
      nextCursor: nextCursor || null,
      hasMore,
    };
  }

  toJSON() {
    return {
      data: this.data,
      pagination: this.pagination,
    };
  }
}

module.exports = {
  AuditEventDTO,
  RuntimeLogLineDTO,
  LogCursor,
  PaginatedLogsResponse,
};
