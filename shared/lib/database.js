// Shared database utilities for Prisma
const { PrismaClient } = require("@prisma/client");

// Create Prisma client factory
const createPrismaClient = (options = {}) => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
    ...options,
  });
};

// Common Prisma utilities
const prismaHelpers = {
  // Handle Prisma errors
  handlePrismaError: (error) => {
    if (error.code === "P2002") {
      return {
        code: "UNIQUE_CONSTRAINT_VIOLATION",
        message: "A record with this data already exists",
        field: error.meta?.target?.[0] || "unknown",
      };
    }

    if (error.code === "P2025") {
      return {
        code: "RECORD_NOT_FOUND",
        message: "The requested record was not found",
      };
    }

    if (error.code === "P2003") {
      return {
        code: "FOREIGN_KEY_CONSTRAINT_VIOLATION",
        message: "Invalid reference to related record",
      };
    }

    return {
      code: "DATABASE_ERROR",
      message: error.message || "Database operation failed",
    };
  },

  // Pagination helper
  getPagination: (page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    return {
      skip,
      take: limit,
    };
  },

  // Format pagination response
  formatPaginatedResponse: (data, total, page, limit) => {
    return {
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Transaction helper
  withTransaction: async (prisma, callback) => {
    return await prisma.$transaction(callback);
  },

  // Soft delete helper (for models with isActive field)
  softDelete: async (model, where) => {
    return await model.update({
      where,
      data: { isActive: false, updatedAt: new Date() },
    });
  },

  // Audit log helper
  createAuditLog: async (
    prisma,
    { userId, action, resource, resourceId, changes, ipAddress, userAgent },
  ) => {
    return await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        changes,
        ipAddress,
        userAgent,
      },
    });
  },
};

module.exports = {
  createPrismaClient,
  prismaHelpers,
};
