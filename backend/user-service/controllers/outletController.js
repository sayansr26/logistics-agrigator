// Outlet Controller - Outlet management (Outlets are tenant entities, NOT customers)
// Handles Outlet CRUD operations and user provisioning via auth-service

const { prisma } = require("../config/database");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { authUtils } = require("../shared/lib/auth");
const { UserServiceError } = require("../middleware/errorHandler");

/**
 * Generate unique outlet code
 */
function generateOutletCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OUT-${timestamp}-${random}`;
}

/**
 * Create auth user in auth-service
 * @param {Object} userData - User data including email, password, firstName, lastName
 * @param {string} authToken - Admin's authorization token to forward
 * @returns {Promise<Object>} Created user data
 */
async function createAuthUser(userData, authToken) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3002";
  const internalSecret = process.env.INTERNAL_SECRET;
  
  // Use internal endpoint for service-to-service user creation
  const response = await fetch(`${authServiceUrl}/auth/internal/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken, // Forward token for audit trail
      "X-Internal-Request": internalSecret, // Internal service-to-service auth
    },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      role: userData.role || "outlet_admin", // Use provided role or default to outlet_admin
      isActive: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new UserServiceError(
      errorData.error?.message || "Failed to create auth user",
      errorData.error?.code || "AUTH_USER_CREATION_FAILED",
      response.status,
    );
  }

  const data = await response.json();
  return data.data?.user;
}

/**
 * Delete auth user in auth-service (for rollback)
 * @param {string} userId - User ID to delete
 * @param {string} authToken - Admin's authorization token to forward
 */
async function deleteAuthUser(userId, authToken) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3002";
  const internalSecret = process.env.INTERNAL_SECRET;
  
  try {
    await fetch(`${authServiceUrl}/auth/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken,
        "X-Internal-Request": internalSecret, // Internal service-to-service auth
      },
    });
  } catch (error) {
    logger.error("Failed to rollback auth user creation", {
      userId,
      error: error.message,
    });
  }
}

/**
 * Create a new outlet with admin user provisioning
 * Permission: outlet:create:all (admin/superadmin only)
 * 
 * Flow:
 * 1. Create auth user via auth-service /auth/users
 * 2. Create Outlet
 * 3. Create UserProfile + OutletUser linkage
 * 4. If any step fails after auth user creation, rollback by deleting auth user
 */
async function createOutlet(req, res) {
  const authToken = req.headers.authorization;
  let createdAuthUserId = null;
  
  try {
    const {
      // Outlet fields
      code,
      name,
      contactPerson,
      email,
      phone,
      type = "RETAIL",
      status = "ACTIVE",
      address,
      city,
      state,
      pincode,
      country = "India",
      gstNumber,
      panNumber,
      bankDetails,
      isActive = true,
      // Admin credentials object (from frontend)
      adminCredentials,
    } = req.body;

    // Extract admin credentials (support both object and flat fields)
    const outletAdminEmail = adminCredentials?.email;
    const outletAdminPassword = adminCredentials?.password;
    const outletAdminFirstName = adminCredentials?.firstName || adminCredentials?.name?.split(" ")[0];
    const outletAdminLastName = adminCredentials?.lastName || adminCredentials?.name?.split(" ").slice(1).join(" ");
    const outletAdminPhone = adminCredentials?.phone || phone;

    // Validate required fields
    if (!name) {
      throw new UserServiceError("Outlet name is required", "NAME_REQUIRED", 400);
    }
    if (!email) {
      throw new UserServiceError("Outlet email is required", "EMAIL_REQUIRED", 400);
    }
    if (!outletAdminEmail || !outletAdminPassword) {
      throw new UserServiceError(
        "Outlet admin email and password are required",
        "ADMIN_CREDENTIALS_REQUIRED",
        400,
      );
    }

    // Generate outlet code if not provided
    const outletCode = code || generateOutletCode();

    // Check if outlet code already exists
    const existingOutlet = await prisma.outlet.findUnique({
      where: { code: outletCode },
    });
    if (existingOutlet) {
      throw new UserServiceError(
        `Outlet with code '${outletCode}' already exists`,
        "OUTLET_CODE_EXISTS",
        409,
      );
    }

    // Check if outlet email already exists
    const existingOutletEmail = await prisma.outlet.findFirst({
      where: { email },
    });
    if (existingOutletEmail) {
      throw new UserServiceError(
        `Outlet with email '${email}' already exists`,
        "OUTLET_EMAIL_EXISTS",
        409,
      );
    }

    // Step 1: Create auth user for outlet admin
    logger.info("Creating auth user for outlet admin", { outletAdminEmail });
    const authUser = await createAuthUser(
      {
        email: outletAdminEmail,
        password: outletAdminPassword,
        firstName: outletAdminFirstName || contactPerson?.split(" ")[0] || "Outlet",
        lastName: outletAdminLastName || contactPerson?.split(" ").slice(1).join(" ") || "Admin",
        phone: outletAdminPhone || phone,
      },
      authToken,
    );
    createdAuthUserId = authUser.id;
    logger.info("Auth user created", { userId: createdAuthUserId });

    // Step 2 & 3: Create Outlet and linkages in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Outlet
      const outlet = await tx.outlet.create({
        data: {
          code: outletCode,
          name,
          contactPerson,
          email,
          phone,
          type,
          status,
          address,
          city,
          state,
          pincode,
          country,
          gstNumber,
          panNumber,
          bankDetails,
          isActive,
        },
      });

      // Create UserProfile for outlet admin
      const userProfile = await tx.userProfile.create({
        data: {
          userId: authUser.id,
          firstName: outletAdminFirstName || contactPerson?.split(" ")[0] || "Outlet",
          lastName: outletAdminLastName || contactPerson?.split(" ").slice(1).join(" ") || "Admin",
          phoneNumber: outletAdminPhone || phone,
          outletId: outlet.id,
          outletRole: "outlet_admin",
          isActive: true,
          isVerified: false,
          profileComplete: false,
        },
      });

      // Create OutletUser linkage
      const outletUser = await tx.outletUser.create({
        data: {
          outletId: outlet.id,
          userId: authUser.id,
          role: "outlet_admin",
          enabledModules: ["shipment", "billing", "wallet", "analytics", "customer", "partner"],
          isActive: true,
        },
      });

      // Create audit log for outlet creation
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CREATE_OUTLET",
          resource: "Outlet",
          resourceId: outlet.id,
          changes: {
            created: {
              outletId: outlet.id,
              code: outlet.code,
              name: outlet.name,
              email: outlet.email,
              type: outlet.type,
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

      // Create audit log for outlet admin creation
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CREATE_OUTLET_USER",
          resource: "OutletUser",
          resourceId: outletUser.id,
          changes: {
            created: {
              outletUserId: outletUser.id,
              outletId: outlet.id,
              userId: authUser.id,
              role: "outlet_admin",
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/outlets",
            createdBy: req.user.role,
            isInitialAdmin: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return { outlet, userProfile, outletUser };
    });

    logger.info("Outlet created successfully", {
      outletId: result.outlet.id,
      outletCode: result.outlet.code,
      name: result.outlet.name,
      adminUserId: authUser.id,
      createdBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        outlet: result.outlet,
        outletAdmin: {
          userId: authUser.id,
          email: authUser.email,
          outletUserId: result.outletUser.id,
          role: result.outletUser.role,
        },
        message: "Outlet created successfully with admin user",
      }),
    );
  } catch (error) {
    // Rollback: delete auth user if created but outlet creation failed
    if (createdAuthUserId) {
      logger.warn("Rolling back auth user creation due to error", {
        userId: createdAuthUserId,
        error: error.message,
      });
      await deleteAuthUser(createdAuthUserId, authToken);
    }

    logger.error("Create outlet error", {
      error: error.message,
      userId: req.user.id,
      requestBody: { ...req.body, outletAdminPassword: "[REDACTED]" },
      service: "user-service",
    });
    throw error;
  }
}

/**
 * List all outlets with pagination and filtering
 * Permission: outlet:read:all (admin/superadmin) or outlet:read:outlet (outlet users)
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
      status,
      type,
      city,
      state,
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
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
    } else if (["outlet_admin", "outlet_staff"].includes(req.user.role)) {
      // Outlet users can only see their own outlet
      if (req.user.outletId) {
        where.id = req.user.outletId;
      } else {
        // No outlet assigned, return empty
        return res.json(
          APIResponse.success({
            outlets: [],
            pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0, hasMore: false },
          }),
        );
      }
    }

    const [outlets, total] = await Promise.all([
      prisma.outlet.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              outletUsers: true,
              customers: true,
            },
          },
        },
      }),
      prisma.outlet.count({ where }),
    ]);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "LIST_OUTLETS",
        resource: "Outlet",
        metadata: {
          source: "user-service",
          endpoint: "/api/v1/outlets",
          filters: { search, isActive, status, type, city, state },
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
          status,
          type,
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
 * Permission: outlet:read:all or outlet:read:outlet (for own outlet)
 */
async function getOutlet(req, res) {
  try {
    const { outletId } = req.params;

    // Check access
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outletId) {
        throw new UserServiceError(
          "Access denied. You can only view your own outlet.",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }
    }

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      include: {
        outletUsers: {
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
            outletUsers: true,
            customers: true,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "GET_OUTLET",
        resource: "Outlet",
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
 * Permission: outlet:update:all or outlet:update:outlet (for own outlet)
 */
async function updateOutlet(req, res) {
  try {
    const { outletId } = req.params;
    const updateData = req.body;

    // Check access
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outletId) {
        throw new UserServiceError(
          "Access denied. You can only update your own outlet.",
          "OUTLET_UPDATE_DENIED",
          403,
        );
      }
    }

    // Get current outlet for audit trail
    const currentOutlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });

    if (!currentOutlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Check for code conflicts if updating code
    if (updateData.code && updateData.code !== currentOutlet.code) {
      const existingOutlet = await prisma.outlet.findUnique({
        where: { code: updateData.code },
      });
      if (existingOutlet) {
        throw new UserServiceError(
          `Outlet with code '${updateData.code}' already exists`,
          "OUTLET_CODE_EXISTS",
          409,
        );
      }
    }

    // Check for email conflicts if updating email
    if (updateData.email && updateData.email !== currentOutlet.email) {
      const existingEmail = await prisma.outlet.findFirst({
        where: {
          email: updateData.email,
          id: { not: outletId },
        },
      });
      if (existingEmail) {
        throw new UserServiceError(
          `Outlet with email '${updateData.email}' already exists`,
          "OUTLET_EMAIL_EXISTS",
          409,
        );
      }
    }

    // Update outlet with transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedOutlet = await tx.outlet.update({
        where: { id: outletId },
        data: updateData,
        include: {
          _count: {
            select: {
              outletUsers: true,
              customers: true,
            },
          },
        },
      });

      // Create audit log with before/after changes
      const changes = {};
      Object.keys(updateData).forEach((key) => {
        if (JSON.stringify(currentOutlet[key]) !== JSON.stringify(updateData[key])) {
          changes[key] = {
            before: currentOutlet[key],
            after: updateData[key],
          };
        }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "UPDATE_OUTLET",
          resource: "Outlet",
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
      code: result.code,
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
 * Permission: outlet:delete:all (admin/superadmin only)
 */
async function deleteOutlet(req, res) {
  try {
    const { outletId } = req.params;

    // Only admin/superadmin can delete outlets
    if (!["superadmin", "admin"].includes(req.user.role)) {
      throw new UserServiceError(
        "Access denied. Only administrators can delete outlets.",
        "OUTLET_DELETE_DENIED",
        403,
      );
    }

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      include: {
        _count: {
          select: {
            outletUsers: true,
            customers: true,
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

    // Soft delete by deactivating
    const result = await prisma.$transaction(async (tx) => {
      const deactivatedOutlet = await tx.outlet.update({
        where: { id: outletId },
        data: {
          isActive: false,
          status: "INACTIVE",
        },
      });

      // Deactivate all outlet users
      await tx.outletUser.updateMany({
        where: { outletId },
        data: { isActive: false },
      });

      // Update user profiles linked to this outlet
      await tx.userProfile.updateMany({
        where: { outletId },
        data: { isActive: false },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "DELETE_OUTLET",
          resource: "Outlet",
          resourceId: outletId,
          changes: {
            deactivated: {
              isActive: { before: true, after: false },
              status: { before: outlet.status, after: "INACTIVE" },
              outletUsersAffected: outlet._count.outletUsers,
              customersAffected: outlet._count.customers,
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
      code: outlet.code,
      name: outlet.name,
      outletUsersAffected: outlet._count.outletUsers,
      customersAffected: outlet._count.customers,
      deletedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message: "Outlet deactivated successfully",
        outlet: {
          id: result.id,
          code: result.code,
          name: result.name,
          isActive: result.isActive,
          status: result.status,
        },
        impact: {
          outletUsersDeactivated: outlet._count.outletUsers,
          customersAffected: outlet._count.customers,
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
 * Permission: outlet:read:all or outlet:read:outlet
 */
async function getOutletByCode(req, res) {
  try {
    const { outletCode } = req.params;

    const outlet = await prisma.outlet.findUnique({
      where: { code: outletCode },
      include: {
        _count: {
          select: {
            outletUsers: true,
            customers: true,
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
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outlet.id) {
        throw new UserServiceError(
          "Access denied. You can only view your own outlet.",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "GET_OUTLET_BY_CODE",
        resource: "Outlet",
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

/**
 * List users for an outlet
 * Permission: outlet:read:outlet or outlet:read:all
 */
async function listOutletUsers(req, res) {
  try {
    const { outletId } = req.params;
    const { page = 1, limit = 20, isActive } = req.query;

    // Check access
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outletId) {
        throw new UserServiceError(
          "Access denied. You can only view users for your own outlet.",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }
    }

    // Verify outlet exists
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });

    if (!outlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for OutletUser
    const where = { outletId };
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const [outletUsers, total] = await Promise.all([
      prisma.outletUser.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.outletUser.count({ where }),
    ]);

    // Enrich with UserProfile data
    const userIds = outletUsers.map((ou) => ou.userId);
    const userProfiles = await prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
    });

    const profileMap = new Map(userProfiles.map((p) => [p.userId, p]));

    // Fetch emails from auth-service
    let emailMap = new Map();
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth-service:3002";
      const authToken = req.headers.authorization;
      
      // Fetch user details from auth-service for each userId
      const emailPromises = userIds.map(async (userId) => {
        try {
          const response = await fetch(`${authServiceUrl}/auth/users/${userId}`, {
            headers: {
              Authorization: authToken,
              "X-Internal-Request": process.env.INTERNAL_SECRET,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.status === "success" && data.data?.user?.email) {
              return { userId, email: data.data.user.email };
            }
          }
          return { userId, email: null };
        } catch (err) {
          logger.warn("Failed to fetch user email from auth-service", { userId, error: err.message });
          return { userId, email: null };
        }
      });
      
      const emailResults = await Promise.all(emailPromises);
      emailMap = new Map(emailResults.map((r) => [r.userId, r.email]));
    } catch (error) {
      logger.warn("Failed to fetch emails from auth-service", { error: error.message });
    }

    const enrichedUsers = outletUsers.map((ou) => ({
      ...ou,
      profile: profileMap.get(ou.userId) || null,
      email: emailMap.get(ou.userId) || null,
    }));

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "LIST_OUTLET_USERS",
        resource: "OutletUser",
        resourceId: outletId,
        metadata: {
          source: "user-service",
          endpoint: `/api/v1/outlets/${outletId}/users`,
          resultCount: outletUsers.length,
          totalCount: total,
          requestingRole: req.user.role,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json(
      APIResponse.success({
        users: enrichedUsers,
        outlet: {
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore: skip + outletUsers.length < total,
        },
      }),
    );
  } catch (error) {
    logger.error("List outlet users error", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.user.id,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Add a user to an outlet (staff)
 * Creates auth user, UserProfile, and OutletUser linkage
 * Permission: user:create:outlet or outlet:manage:outlet
 */
async function addOutletUser(req, res) {
  const authToken = req.headers.authorization;
  let createdAuthUserId = null;

  try {
    const { outletId } = req.params;
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role = "outlet_staff",
      enabledModules = ["shipment", "billing", "wallet", "analytics"],
    } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new UserServiceError(
        "Email and password are required",
        "CREDENTIALS_REQUIRED",
        400,
      );
    }

    // Check access
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outletId) {
        throw new UserServiceError(
          "Access denied. You can only add users to your own outlet.",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }
    }

    // Verify outlet exists
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });

    if (!outlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Validate role
    if (!["outlet_admin", "outlet_staff"].includes(role)) {
      throw new UserServiceError(
        "Invalid role. Must be 'outlet_admin' or 'outlet_staff'",
        "INVALID_ROLE",
        400,
      );
    }

    // Step 1: Create auth user
    logger.info("Creating auth user for outlet staff", { email, outletId, role });
    const authUser = await createAuthUser(
      {
        email,
        password,
        firstName: firstName || "Staff",
        lastName: lastName || "User",
        phone,
        role, // Pass the role (outlet_admin or outlet_staff)
      },
      authToken,
    );
    createdAuthUserId = authUser.id;

    // Step 2: Create UserProfile and OutletUser in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create UserProfile
      const userProfile = await tx.userProfile.create({
        data: {
          userId: authUser.id,
          firstName: firstName || "Staff",
          lastName: lastName || "User",
          phoneNumber: phone,
          outletId: outlet.id,
          outletRole: role,
          isActive: true,
          isVerified: false,
          profileComplete: false,
        },
      });

      // Create OutletUser linkage
      const outletUser = await tx.outletUser.create({
        data: {
          outletId,
          userId: authUser.id,
          role,
          enabledModules,
          isActive: true,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "ADD_OUTLET_USER",
          resource: "OutletUser",
          resourceId: outletUser.id,
          changes: {
            created: {
              outletUserId: outletUser.id,
              userId: authUser.id,
              outletId,
              role,
              enabledModules,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/outlets/${outletId}/users`,
            addedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return { userProfile, outletUser };
    });

    logger.info("Outlet user added successfully", {
      outletId,
      userId: authUser.id,
      role,
      outletUserId: result.outletUser.id,
      addedBy: req.user.id,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        message: "User added to outlet successfully",
        user: {
          userId: authUser.id,
          email: authUser.email,
          ...result.outletUser,
          profile: result.userProfile,
        },
        outlet: {
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
        },
      }),
    );
  } catch (error) {
    // Rollback: delete auth user if created
    if (createdAuthUserId) {
      logger.warn("Rolling back auth user creation due to error", {
        userId: createdAuthUserId,
        error: error.message,
      });
      await deleteAuthUser(createdAuthUserId, authToken);
    }

    logger.error("Add outlet user error", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.user.id,
      requestBody: { ...req.body, password: "[REDACTED]" },
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Update an outlet user's profile and role
 * Permission: customer:update:assigned or outlet_admin for own outlet
 */
async function updateOutletUser(req, res) {
  try {
    const { outletId, userId } = req.params;
    const { firstName, lastName, phone, role } = req.body;

    // Check access
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outletId) {
        throw new UserServiceError(
          "Access denied. You can only update users in your own outlet.",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }
    }

    // Verify outlet exists
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });

    if (!outlet) {
      throw new UserServiceError(
        `Outlet with ID '${outletId}' not found`,
        "OUTLET_NOT_FOUND",
        404,
      );
    }

    // Find the outlet user association
    const outletUser = await prisma.outletUser.findFirst({
      where: {
        outletId,
        userId,
      },
    });

    if (!outletUser) {
      throw new UserServiceError(
        `User not associated with outlet '${outletId}'`,
        "OUTLET_USER_NOT_FOUND",
        404,
      );
    }

    // Update the user's profile and outlet user role in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update UserProfile
      const updatedProfile = await tx.userProfile.upsert({
        where: { userId },
        update: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phoneNumber: phone || undefined,
        },
        create: {
          userId,
          firstName: firstName || "",
          lastName: lastName || "",
          phoneNumber: phone || "",
          outletId,
          outletRole: role || "outlet_staff",
        },
      });

      // Update OutletUser role if provided
      let updatedOutletUser = outletUser;
      if (role && ["outlet_admin", "outlet_staff"].includes(role)) {
        updatedOutletUser = await tx.outletUser.update({
          where: { id: outletUser.id },
          data: { role },
        });
      }

      return { profile: updatedProfile, outletUser: updatedOutletUser };
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE_OUTLET_USER",
        resource: "OutletUser",
        resourceId: outletUser.id,
        changes: { firstName, lastName, phone, role },
        metadata: {
          outletId,
          targetUserId: userId,
          outletName: outlet.name,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    logger.info("Outlet user updated", {
      outletId,
      userId,
      updatedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        user: {
          ...result.outletUser,
          profile: result.profile,
        },
        outlet: {
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
        },
      }),
    );
  } catch (error) {
    logger.error("Failed to update outlet user", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.params.userId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Remove a user from an outlet (deactivate the association)
 * Permission: user:delete:outlet or outlet:manage:outlet
 */
async function removeOutletUser(req, res) {
  try {
    const { outletId, userId } = req.params;

    // Check access
    if (!["superadmin", "admin"].includes(req.user.role)) {
      if (req.user.outletId !== outletId) {
        throw new UserServiceError(
          "Access denied. You can only remove users from your own outlet.",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }
    }

    // Find the OutletUser linkage
    const outletUser = await prisma.outletUser.findUnique({
      where: {
        outletId_userId: {
          outletId,
          userId,
        },
      },
    });

    if (!outletUser) {
      throw new UserServiceError(
        "User is not associated with this outlet",
        "USER_NOT_FOUND",
        404,
      );
    }

    // Soft delete (deactivate) the association
    const result = await prisma.$transaction(async (tx) => {
      const updatedOutletUser = await tx.outletUser.update({
        where: {
          outletId_userId: {
            outletId,
            userId,
          },
        },
        data: { isActive: false },
      });

      // Also update UserProfile if it was linked to this outlet
      await tx.userProfile.updateMany({
        where: {
          userId,
          outletId,
        },
        data: {
          outletId: null,
          outletRole: null,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "REMOVE_OUTLET_USER",
          resource: "OutletUser",
          resourceId: outletUser.id,
          changes: {
            deactivated: {
              outletUserId: outletUser.id,
              userId,
              outletId,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/outlets/${outletId}/users/${userId}`,
            removedBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return updatedOutletUser;
    });

    logger.warn("Outlet user removed", {
      outletId,
      userId,
      outletUserId: result.id,
      removedBy: req.user.id,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        message: "User removed from outlet successfully",
        outletUserId: result.id,
      }),
    );
  } catch (error) {
    logger.error("Remove outlet user error", {
      error: error.message,
      outletId: req.params.outletId,
      userId: req.params.userId,
      requestUserId: req.user.id,
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
  listOutletUsers,
  addOutletUser,
  updateOutletUser,
  removeOutletUser,
};
