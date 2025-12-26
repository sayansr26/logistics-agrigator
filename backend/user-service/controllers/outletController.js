// Outlet Controller - Outlet management (Customers with customerType=OUTLET)
// Handles outlet CRUD operations as a filtered view of the Customer model

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { authUtils } = require("../shared/lib/auth");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Create a new outlet (Customer with customerType=OUTLET)
 * Permission: customer:create:parent
 */
async function createOutlet(req, res) {
  try {
    const {
      name,
      email,
      phone,
      monthlyShipmentLimit,
      enabledModules = ["shipment", "billing", "wallet", "analytics"],
      isActive = true,
      // Outlet-specific required fields
      outletCode,
      outletName,
      contactPerson,
      address,
      city,
      state,
      pincode,
      // Outlet-specific optional fields
      retailerName,
      outletStatus = "active",
      outletType,
      businessHours,
      gstNumber,
      panNumber,
      bankDetails,
      assignedCouriers = [],
      serviceAreas = [],
      country = "India",
      // Optional clientId
      clientId: requestClientId,
    } = req.body;

    // Get client ID - for admin/superadmin it can come from request body
    let clientId;
    if (["superadmin", "admin"].includes(req.user.role)) {
      clientId = requestClientId || null;
    } else {
      clientId =
        req.user.role === "client" ? req.user.id : req.user.parentClientId;
    }

    // Check if customer email already exists
    let existingCustomer;
    if (clientId) {
      existingCustomer = await prisma.customer.findFirst({
        where: { clientId, email },
      });
    } else {
      existingCustomer = await prisma.customer.findFirst({
        where: { clientId: null, email },
      });
    }

    if (existingCustomer) {
      throw new UserServiceError(
        clientId
          ? `Customer with email '${email}' already exists for this client`
          : `Customer with email '${email}' already exists`,
        "CUSTOMER_EMAIL_EXISTS",
        409,
      );
    }

    // Check outlet code uniqueness
    if (outletCode) {
      const existingOutlet = await prisma.customer.findFirst({
        where: { outletCode },
      });
      if (existingOutlet) {
        throw new UserServiceError(
          `Outlet with code '${outletCode}' already exists`,
          "OUTLET_CODE_EXISTS",
          409,
        );
      }
    }

    // Create outlet with transaction for audit logging
    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.customer.create({
        data: {
          clientId,
          customerType: "OUTLET",
          name,
          email,
          phone,
          monthlyShipmentLimit,
          enabledModules,
          isActive,
          // Outlet-specific fields
          outletCode,
          outletName,
          retailerName,
          contactPerson,
          outletStatus,
          outletType,
          businessHours,
          gstNumber,
          panNumber,
          bankDetails,
          assignedCouriers,
          serviceAreas,
          address,
          city,
          state,
          pincode,
          country,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              userProfiles: true,
              customerUsers: true,
            },
          },
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId,
          action: "CREATE_OUTLET",
          resource: "Customer",
          resourceId: outlet.id,
          changes: {
            created: {
              name: outlet.name,
              email: outlet.email,
              outletCode: outlet.outletCode,
              outletName: outlet.outletName,
              customerType: "OUTLET",
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/outlets",
            createdBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return outlet;
    });

    logger.info("Outlet created successfully", {
      outletId: result.id,
      outletCode: result.outletCode,
      name: result.name,
      clientId,
      createdBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        outlet: result,
        message: "Outlet created successfully",
      }),
    );
  } catch (error) {
    logger.error("Create outlet error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * List all outlets with pagination and filtering
 * Permission: customer:read:assigned or customer:read:parent
 */
async function listOutlets(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      isActive,
      startDate,
      endDate,
      clientId: filterClientId,
      outletStatus,
      outletType,
      city,
      state,
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause - always filter for OUTLET type
    const where = { customerType: "OUTLET" };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { outletCode: { contains: search, mode: "insensitive" } },
        { outletName: { contains: search, mode: "insensitive" } },
        { retailerName: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (filterClientId) {
      where.clientId = filterClientId;
    }

    if (outletStatus) {
      where.outletStatus = outletStatus;
    }

    if (outletType) {
      where.outletType = outletType;
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    if (state) {
      where.state = { contains: state, mode: "insensitive" };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Apply RBAC scope filtering
    if (["superadmin", "admin"].includes(req.user.role)) {
      // Full access - no additional filtering
    } else if (req.user.role === "client") {
      where.clientId = req.user.id;
    } else if (req.user.parentClientId) {
      where.clientId = req.user.parentClientId;
    } else if (
      req.user.assignedCustomerIds &&
      req.user.assignedCustomerIds.length > 0
    ) {
      where.id = { in: req.user.assignedCustomerIds };
    }

    const [outlets, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              userProfiles: true,
              customerUsers: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "LIST_OUTLETS",
        resource: "Customer",
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/outlets",
          filters: { search, isActive, outletStatus, outletType, city, state },
          pagination: { page, limit },
          resultCount: outlets.length,
          totalCount: total,
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    const hasMore = skip + outlets.length < total;
    const totalPages = Math.ceil(total / limit);

    res.json(
      APIResponse.success({
        outlets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
        },
        filters: {
          search,
          isActive,
          outletStatus,
          outletType,
          city,
          state,
          startDate,
          endDate,
        },
      }),
    );
  } catch (error) {
    logger.error("List outlets error", {
      error: error.message,
      userId: req.user.id,
      query: req.query,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get a specific outlet by ID
 * Permission: customer:read:assigned
 */
async function getOutlet(req, res) {
  try {
    const { outletId } = req.params;

    // Check access using checkCustomerAccess
    const hasAccess = await authUtils.checkCustomerAccess(req.user, outletId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to view this outlet.",
        "OUTLET_ACCESS_DENIED",
        403,
      );
    }

    const outlet = await prisma.customer.findUnique({
      where: { id: outletId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        userProfiles: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        customerUsers: {
          select: {
            id: true,
            userId: true,
            role: true,
            enabledModules: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            userProfiles: true,
            customerUsers: true,
          },
        },
      },
    });

    if (!outlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Verify it's actually an outlet
    if (outlet.customerType !== "OUTLET") {
      throw new UserServiceError(
        `Customer with ID '${outletId}' is not an outlet`,
        "NOT_AN_OUTLET",
        400,
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        clientId: outlet.clientId,
        action: "GET_OUTLET",
        resource: "Customer",
        resourceId: outlet.id,
        metadata: {
          source: "user-service",
          endpoint: `/api/v1/outlets/${outletId}`,
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success({ outlet }));
  } catch (error) {
    logger.error("Get outlet error", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Update an outlet
 * Permission: customer:update:assigned
 */
async function updateOutlet(req, res) {
  try {
    const { outletId } = req.params;
    const updateData = req.body;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, outletId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to update this outlet.",
        "OUTLET_UPDATE_DENIED",
        403,
      );
    }

    // Get current outlet for audit trail
    const currentOutlet = await prisma.customer.findUnique({
      where: { id: outletId },
    });

    if (!currentOutlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Verify it's actually an outlet
    if (currentOutlet.customerType !== "OUTLET") {
      throw new UserServiceError(
        `Customer with ID '${outletId}' is not an outlet`,
        "NOT_AN_OUTLET",
        400,
      );
    }

    // Check for email conflicts if updating email
    if (updateData.email && updateData.email !== currentOutlet.email) {
      let existingEmail;
      if (currentOutlet.clientId) {
        existingEmail = await prisma.customer.findFirst({
          where: {
            clientId: currentOutlet.clientId,
            email: updateData.email,
            id: { not: outletId },
          },
        });
      } else {
        existingEmail = await prisma.customer.findFirst({
          where: {
            clientId: null,
            email: updateData.email,
            id: { not: outletId },
          },
        });
      }

      if (existingEmail) {
        throw new UserServiceError(
          `Customer with email '${updateData.email}' already exists`,
          "CUSTOMER_EMAIL_EXISTS",
          409,
        );
      }
    }

    // Check for outlet code conflicts if updating outletCode
    if (
      updateData.outletCode &&
      updateData.outletCode !== currentOutlet.outletCode
    ) {
      const existingOutlet = await prisma.customer.findFirst({
        where: {
          outletCode: updateData.outletCode,
          id: { not: outletId },
        },
      });

      if (existingOutlet) {
        throw new UserServiceError(
          `Outlet with code '${updateData.outletCode}' already exists`,
          "OUTLET_CODE_EXISTS",
          409,
        );
      }
    }

    // Prevent changing customerType from OUTLET
    delete updateData.customerType;

    // Update outlet with transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedOutlet = await tx.customer.update({
        where: { id: outletId },
        data: updateData,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              userProfiles: true,
              customerUsers: true,
            },
          },
        },
      });

      // Create audit log with before/after changes
      const changes = {};
      Object.keys(updateData).forEach((key) => {
        if (
          JSON.stringify(currentOutlet[key]) !== JSON.stringify(updateData[key])
        ) {
          changes[key] = {
            before: currentOutlet[key],
            after: updateData[key],
          };
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: updatedOutlet.clientId,
          action: "UPDATE_OUTLET",
          resource: "Customer",
          resourceId: updatedOutlet.id,
          changes,
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/outlets/${outletId}`,
            updatedBy: req.user.role,
            fieldsUpdated: Object.keys(updateData),
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return updatedOutlet;
    });

    logger.info("Outlet updated successfully", {
      outletId: result.id,
      outletCode: result.outletCode,
      updatedFields: Object.keys(updateData),
      updatedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        outlet: result,
        message: "Outlet updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Update outlet error", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.user.id,
      updateData: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Soft delete an outlet (deactivate)
 * Permission: customer:delete:assigned
 */
async function deleteOutlet(req, res) {
  try {
    const { outletId } = req.params;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, outletId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to delete this outlet.",
        "OUTLET_DELETE_DENIED",
        403,
      );
    }

    const outlet = await prisma.customer.findUnique({
      where: { id: outletId },
      include: {
        _count: {
          select: {
            userProfiles: true,
            customerUsers: true,
          },
        },
      },
    });

    if (!outlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Verify it's actually an outlet
    if (outlet.customerType !== "OUTLET") {
      throw new UserServiceError(
        `Customer with ID '${outletId}' is not an outlet`,
        "NOT_AN_OUTLET",
        400,
      );
    }

    // Soft delete by deactivating
    const result = await prisma.$transaction(async (tx) => {
      const deactivatedOutlet = await tx.customer.update({
        where: { id: outletId },
        data: {
          isActive: false,
          outletStatus: "inactive",
        },
      });

      // Also deactivate all user profiles for this outlet
      await tx.userProfile.updateMany({
        where: { customerId: outletId },
        data: { isActive: false },
      });

      // Deactivate customer users
      await tx.customerUser.updateMany({
        where: { customerId: outletId },
        data: { isActive: false },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: outlet.clientId,
          action: "DELETE_OUTLET",
          resource: "Customer",
          resourceId: outletId,
          changes: {
            deactivated: {
              isActive: { before: true, after: false },
              outletStatus: { before: outlet.outletStatus, after: "inactive" },
              userProfilesAffected: outlet._count.userProfiles,
              customerUsersAffected: outlet._count.customerUsers,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/outlets/${outletId}`,
            deletedBy: req.user.role,
            softDelete: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return deactivatedOutlet;
    });

    logger.warn("Outlet deactivated", {
      outletId,
      outletCode: outlet.outletCode,
      outletName: outlet.outletName,
      userProfilesAffected: outlet._count.userProfiles,
      customerUsersAffected: outlet._count.customerUsers,
      deletedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message: "Outlet deactivated successfully",
        outlet: {
          id: result.id,
          outletCode: result.outletCode,
          name: result.name,
          isActive: result.isActive,
          outletStatus: result.outletStatus,
        },
        impact: {
          userProfilesDeactivated: outlet._count.userProfiles,
          customerUsersDeactivated: outlet._count.customerUsers,
        },
      }),
    );
  } catch (error) {
    logger.error("Delete outlet error", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get outlet by code
 * Permission: customer:read:assigned
 */
async function getOutletByCode(req, res) {
  try {
    const { outletCode } = req.params;

    const outlet = await prisma.customer.findFirst({
      where: {
        outletCode,
        customerType: "OUTLET",
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            userProfiles: true,
            customerUsers: true,
          },
        },
      },
    });

    if (!outlet) {
      throw new UserServiceError(
        `Outlet with code '${outletCode}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, outlet.id);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to view this outlet.",
        "OUTLET_ACCESS_DENIED",
        403,
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        clientId: outlet.clientId,
        action: "GET_OUTLET_BY_CODE",
        resource: "Customer",
        resourceId: outlet.id,
        metadata: {
          source: "user-service",
          endpoint: `/api/v1/outlets/code/${outletCode}`,
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success({ outlet }));
  } catch (error) {
    logger.error("Get outlet by code error", {
      error: error.message,
      outletCode: req.params.outletCode,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

module.exports = {
  createOutlet,
  listOutlets,
  getOutlet,
  updateOutlet,
  deleteOutlet,
  getOutletByCode,
};
