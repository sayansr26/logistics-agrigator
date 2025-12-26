// Customer Controller - Customer management for RBAC system
// Handles customer CRUD operations, sub-user management, and module access control

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { authUtils } = require("../shared/lib/auth");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Create a new customer under a client
 * Permission: customer:create:parent
 * Supports both DIRECT (B2C) and OUTLET (B2B) customer types
 */
async function createCustomer(req, res) {
  try {
    const {
      name,
      email,
      phone,
      monthlyShipmentLimit,
      enabledModules = ["shipment", "billing", "wallet", "analytics"],
      isActive = true,
      customerType = "DIRECT",
      // Outlet-specific fields
      outletCode,
      outletName,
      retailerName,
      contactPerson,
      outletStatus = "active",
      outletType,
      businessHours,
      gstNumber,
      panNumber,
      bankDetails,
      assignedCouriers = [],
      serviceAreas = [],
      address,
      city,
      state,
      pincode,
      country = "India",
      // Optional clientId for direct customers (can be null)
      clientId: requestClientId,
    } = req.body;

    // Get client ID - for admin/superadmin it can come from request body, for client role it's their own ID
    let clientId;
    if (["superadmin", "admin"].includes(req.user.role)) {
      clientId = requestClientId || null; // Admin can create direct customers without client
    } else {
      clientId =
        req.user.role === "client" ? req.user.id : req.user.parentClientId;
    }

    // Check if customer email already exists (using the new partial index logic)
    let existingCustomer;
    if (clientId) {
      // Check within client scope
      existingCustomer = await prisma.customer.findFirst({
        where: {
          clientId,
          email,
        },
      });
    } else {
      // Check direct customers (no client)
      existingCustomer = await prisma.customer.findFirst({
        where: {
          clientId: null,
          email,
        },
      });
    }

    if (existingCustomer) {
      throw new UserServiceError(
        clientId
          ? `Customer with email '${email}' already exists for this client`
          : `Direct customer with email '${email}' already exists`,
        "CUSTOMER_EMAIL_EXISTS",
        409,
      );
    }

    // For OUTLET type, check outlet code uniqueness
    if (customerType === "OUTLET" && outletCode) {
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

    // Create customer with transaction for audit logging
    const result = await prisma.$transaction(async (tx) => {
      const customerData = {
        clientId,
        customerType,
        name,
        email,
        phone,
        monthlyShipmentLimit,
        enabledModules,
        isActive,
      };

      // Add outlet-specific fields if OUTLET type
      if (customerType === "OUTLET") {
        Object.assign(customerData, {
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
        });
      }

      const customer = await tx.customer.create({
        data: customerData,
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
          action: "CREATE_CUSTOMER",
          resource: "Customer",
          resourceId: customer.id,
          changes: {
            created: {
              name: customer.name,
              email: customer.email,
              customerType: customer.customerType,
              monthlyShipmentLimit: customer.monthlyShipmentLimit,
              enabledModules: customer.enabledModules,
              ...(customerType === "OUTLET" && { outletCode, outletName }),
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/customers",
            createdBy: req.user.role,
            customerType,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return customer;
    });

    logger.info("Customer created successfully", {
      customerId: result.id,
      name: result.name,
      customerType: result.customerType,
      clientId,
      createdBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        customer: result,
        message: "Customer created successfully",
      }),
    );
  } catch (error) {
    logger.error("Create customer error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * List all customers with pagination and filtering
 * Permission: customer:read:assigned or customer:read:parent
 * Supports filtering by customerType (DIRECT or OUTLET)
 */
async function listCustomers(req, res) {
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
      customerType, // Filter by DIRECT or OUTLET
      clientId: filterClientId, // Filter by specific client
      outletStatus, // Filter by outlet status
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { outletCode: { contains: search, mode: "insensitive" } },
        { outletName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (customerType) {
      where.customerType = customerType;
    }

    if (filterClientId) {
      where.clientId = filterClientId;
    }

    if (outletStatus) {
      where.outletStatus = outletStatus;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Apply RBAC scope filtering - handle customer table differently
    // The applyScopeFilter assumes customerId field exists, but for Customer table we filter by id
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

    const [customers, total] = await Promise.all([
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
        action: "LIST_CUSTOMERS",
        resource: "Customer",
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/customers",
          filters: { search, isActive, customerType, outletStatus },
          pagination: { page, limit },
          resultCount: customers.length,
          totalCount: total,
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    const hasMore = skip + customers.length < total;
    const totalPages = Math.ceil(total / limit);

    res.json(
      APIResponse.success({
        customers,
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
          customerType,
          outletStatus,
          startDate,
          endDate,
        },
      }),
    );
  } catch (error) {
    logger.error("List customers error", {
      error: error.message,
      userId: req.user.id,
      query: req.query,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get a specific customer by ID
 * Permission: customer:read:assigned
 */
async function getCustomer(req, res) {
  try {
    const { customerId } = req.params;

    // Check access using checkCustomerAccess
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to view this customer.",
        "CUSTOMER_ACCESS_DENIED",
        403,
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
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

    if (!customer) {
      throw new UserServiceError(
        `Customer with ID '${customerId}' not found`,
        "CUSTOMER_NOT_FOUND",
        404,
      );
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        clientId: customer.clientId,
        action: "GET_CUSTOMER",
        resource: "Customer",
        resourceId: customer.id,
        metadata: {
          source: "user-service",
          endpoint: `/api/v1/customers/${customerId}`,
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json(APIResponse.success({ customer }));
  } catch (error) {
    logger.error("Get customer error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Update a customer
 * Permission: customer:update:assigned
 * Supports updating both DIRECT and OUTLET customer fields
 */
async function updateCustomer(req, res) {
  try {
    const { customerId } = req.params;
    const updateData = req.body;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to update this customer.",
        "CUSTOMER_UPDATE_DENIED",
        403,
      );
    }

    // Get current customer for audit trail
    const currentCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!currentCustomer) {
      throw new UserServiceError(
        `Customer with ID '${customerId}' not found`,
        "CUSTOMER_NOT_FOUND",
        404,
      );
    }

    // Check for email conflicts if updating email (using new partial index logic)
    if (updateData.email && updateData.email !== currentCustomer.email) {
      let existingEmail;
      if (currentCustomer.clientId) {
        existingEmail = await prisma.customer.findFirst({
          where: {
            clientId: currentCustomer.clientId,
            email: updateData.email,
            id: { not: customerId },
          },
        });
      } else {
        existingEmail = await prisma.customer.findFirst({
          where: {
            clientId: null,
            email: updateData.email,
            id: { not: customerId },
          },
        });
      }

      if (existingEmail) {
        throw new UserServiceError(
          currentCustomer.clientId
            ? `Customer with email '${updateData.email}' already exists for this client`
            : `Direct customer with email '${updateData.email}' already exists`,
          "CUSTOMER_EMAIL_EXISTS",
          409,
        );
      }
    }

    // Check for outlet code conflicts if updating outletCode
    if (
      updateData.outletCode &&
      updateData.outletCode !== currentCustomer.outletCode
    ) {
      const existingOutlet = await prisma.customer.findFirst({
        where: {
          outletCode: updateData.outletCode,
          id: { not: customerId },
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

    // Update customer with transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
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
          JSON.stringify(currentCustomer[key]) !==
          JSON.stringify(updateData[key])
        ) {
          changes[key] = {
            before: currentCustomer[key],
            after: updateData[key],
          };
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: updatedCustomer.clientId,
          action: "UPDATE_CUSTOMER",
          resource: "Customer",
          resourceId: updatedCustomer.id,
          changes,
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/customers/${customerId}`,
            updatedBy: req.user.role,
            fieldsUpdated: Object.keys(updateData),
            customerType: updatedCustomer.customerType,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return updatedCustomer;
    });

    logger.info("Customer updated successfully", {
      customerId: result.id,
      customerType: result.customerType,
      updatedFields: Object.keys(updateData),
      updatedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        customer: result,
        message: "Customer updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Update customer error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user.id,
      updateData: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Soft delete a customer (deactivate)
 * Permission: customer:delete:assigned
 */
async function deleteCustomer(req, res) {
  try {
    const { customerId } = req.params;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to delete this customer.",
        "CUSTOMER_DELETE_DENIED",
        403,
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        _count: {
          select: {
            userProfiles: true,
            customerUsers: true,
          },
        },
      },
    });

    if (!customer) {
      throw new UserServiceError(
        `Customer with ID '${customerId}' not found`,
        "CUSTOMER_NOT_FOUND",
        404,
      );
    }

    // Soft delete by deactivating
    const result = await prisma.$transaction(async (tx) => {
      const deactivatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: { isActive: false },
      });

      // Also deactivate all user profiles for this customer
      await tx.userProfile.updateMany({
        where: { customerId },
        data: { isActive: false },
      });

      // Deactivate customer users
      await tx.customerUser.updateMany({
        where: { customerId },
        data: { isActive: false },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: customer.clientId,
          action: "DELETE_CUSTOMER",
          resource: "Customer",
          resourceId: customerId,
          changes: {
            deactivated: {
              isActive: { before: true, after: false },
              userProfilesAffected: customer._count.userProfiles,
              customerUsersAffected: customer._count.customerUsers,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/customers/${customerId}`,
            deletedBy: req.user.role,
            softDelete: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return deactivatedCustomer;
    });

    logger.warn("Customer deactivated", {
      customerId,
      customerName: customer.name,
      userProfilesAffected: customer._count.userProfiles,
      customerUsersAffected: customer._count.customerUsers,
      deletedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message: "Customer deactivated successfully",
        customer: {
          id: result.id,
          name: result.name,
          isActive: result.isActive,
        },
        impact: {
          userProfilesDeactivated: customer._count.userProfiles,
          customerUsersDeactivated: customer._count.customerUsers,
        },
      }),
    );
  } catch (error) {
    logger.error("Delete customer error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Add sub-user to customer (customer team member)
 * Permission: customer:manage:parent
 */
async function addCustomerUser(req, res) {
  try {
    const { customerId } = req.params;
    const {
      userId,
      role = "customer",
      enabledModules = ["shipment", "billing"],
    } = req.body;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to manage this customer.",
        "CUSTOMER_MANAGE_DENIED",
        403,
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new UserServiceError(
        `Customer with ID '${customerId}' not found`,
        "CUSTOMER_NOT_FOUND",
        404,
      );
    }

    // Check if user is already assigned to this customer
    const existingAssignment = await prisma.customerUser.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId,
        },
      },
    });

    if (existingAssignment) {
      throw new UserServiceError(
        "User is already assigned to this customer",
        "USER_ALREADY_ASSIGNED",
        409,
      );
    }

    // Create customer user with transaction
    const result = await prisma.$transaction(async (tx) => {
      const customerUser = await tx.customerUser.create({
        data: {
          customerId,
          userId,
          role,
          enabledModules,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: customer.clientId,
          action: "ADD_CUSTOMER_USER",
          resource: "CustomerUser",
          resourceId: customerUser.id,
          changes: {
            created: {
              customerId,
              userId,
              role,
              enabledModules,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/customers/${customerId}/users`,
            createdBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return customerUser;
    });

    logger.info("Customer user added successfully", {
      customerUserId: result.id,
      customerId,
      userId,
      role,
      addedBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        customerUser: result,
        message: "Customer user added successfully",
      }),
    );
  } catch (error) {
    logger.error("Add customer user error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user.id,
      requestBody: req.body,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * List customer sub-users
 * Permission: customer:read:assigned
 */
async function listCustomerUsers(req, res) {
  try {
    const { customerId } = req.params;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to view this customer.",
        "CUSTOMER_ACCESS_DENIED",
        403,
      );
    }

    const customerUsers = await prisma.customerUser.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      APIResponse.success({
        customerUsers,
        count: customerUsers.length,
      }),
    );
  } catch (error) {
    logger.error("List customer users error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Update customer sub-user
 * Permission: customer:update:assigned
 */
async function updateCustomerUser(req, res) {
  try {
    const { customerId, userId } = req.params;
    const updateData = req.body;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to update this customer.",
        "CUSTOMER_UPDATE_DENIED",
        403,
      );
    }

    // Get current customer user for audit trail
    const currentCustomerUser = await prisma.customerUser.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId,
        },
      },
    });

    if (!currentCustomerUser) {
      throw new UserServiceError(
        "Customer user not found",
        "CUSTOMER_USER_NOT_FOUND",
        404,
      );
    }

    // Update with transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedCustomerUser = await tx.customerUser.update({
        where: {
          customerId_userId: {
            customerId,
            userId,
          },
        },
        data: updateData,
      });

      // Create audit log
      const changes = {};
      Object.keys(updateData).forEach((key) => {
        if (currentCustomerUser[key] !== updateData[key]) {
          changes[key] = {
            before: currentCustomerUser[key],
            after: updateData[key],
          };
        }
      });

      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { clientId: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: customer.clientId,
          action: "UPDATE_CUSTOMER_USER",
          resource: "CustomerUser",
          resourceId: updatedCustomerUser.id,
          changes,
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/customers/${customerId}/users/${userId}`,
            updatedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return updatedCustomerUser;
    });

    logger.info("Customer user updated successfully", {
      customerUserId: result.id,
      customerId,
      userId,
      updatedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        customerUser: result,
        message: "Customer user updated successfully",
      }),
    );
  } catch (error) {
    logger.error("Update customer user error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.params.userId,
      requestingUser: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Remove customer sub-user
 * Permission: customer:delete:assigned
 */
async function removeCustomerUser(req, res) {
  try {
    const { customerId, userId } = req.params;

    // Check access
    const hasAccess = await authUtils.checkCustomerAccess(req.user, customerId);

    if (!hasAccess) {
      throw new UserServiceError(
        "Access denied. You do not have permission to manage this customer.",
        "CUSTOMER_MANAGE_DENIED",
        403,
      );
    }

    // Soft delete by deactivating
    const result = await prisma.$transaction(async (tx) => {
      const customerUser = await tx.customerUser.update({
        where: {
          customerId_userId: {
            customerId,
            userId,
          },
        },
        data: { isActive: false },
      });

      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { clientId: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          clientId: customer.clientId,
          action: "REMOVE_CUSTOMER_USER",
          resource: "CustomerUser",
          resourceId: customerUser.id,
          changes: {
            deactivated: {
              isActive: { before: true, after: false },
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/customers/${customerId}/users/${userId}`,
            removedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return customerUser;
    });

    logger.warn("Customer user removed", {
      customerUserId: result.id,
      customerId,
      userId,
      removedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message: "Customer user removed successfully",
      }),
    );
  } catch (error) {
    logger.error("Remove customer user error", {
      error: error.message,
      customerId: req.params.customerId,
      userId: req.params.userId,
      requestingUser: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerUser,
  listCustomerUsers,
  updateCustomerUser,
  removeCustomerUser,
};
