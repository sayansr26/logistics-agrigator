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
    } = req.body;

    // Get client ID from authenticated user
    const clientId =
      req.user.role === "client" ? req.user.id : req.user.parentClientId;

    if (!clientId) {
      throw new UserServiceError(
        "Client ID not found. Only client role can create customers.",
        "CLIENT_ID_REQUIRED",
        400,
      );
    }

    // Check if customer email already exists for this client
    const existingCustomer = await prisma.customer.findUnique({
      where: {
        clientId_email: {
          clientId,
          email,
        },
      },
    });

    if (existingCustomer) {
      throw new UserServiceError(
        `Customer with email '${email}' already exists for this client`,
        "CUSTOMER_EMAIL_EXISTS",
        409,
      );
    }

    // Create customer with transaction for audit logging
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          clientId,
          name,
          email,
          phone,
          monthlyShipmentLimit,
          enabledModules,
          isActive,
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
          action: "CREATE_CUSTOMER",
          resource: "Customer",
          resourceId: customer.id,
          changes: {
            created: {
              name: customer.name,
              email: customer.email,
              monthlyShipmentLimit: customer.monthlyShipmentLimit,
              enabledModules: customer.enabledModules,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/customers",
            createdBy: req.user.role,
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
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    let where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Apply RBAC scope filtering
    where = authUtils.applyScopeFilter(req, where);

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
          filters: { search, isActive },
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

    // Check for email conflicts if updating email
    if (updateData.email && updateData.email !== currentCustomer.email) {
      const existingEmail = await prisma.customer.findUnique({
        where: {
          clientId_email: {
            clientId: currentCustomer.clientId,
            email: updateData.email,
          },
        },
      });

      if (existingEmail) {
        throw new UserServiceError(
          `Customer with email '${updateData.email}' already exists for this client`,
          "CUSTOMER_EMAIL_EXISTS",
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
        if (currentCustomer[key] !== updateData[key]) {
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
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return updatedCustomer;
    });

    logger.info("Customer updated successfully", {
      customerId: result.id,
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
