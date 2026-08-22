// Outlet Controller - Outlet/customer management
// Handles outlet CRUD operations and address management

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const crypto = require("crypto");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

// API Gateway URL for creating users
const API_GATEWAY_URL =
  process.env.API_GATEWAY_URL || "http://api-gateway:3001";

class OutletController {
  /**
   * Create a new outlet (client/admin only)
   * Generates password, creates auth user, and outlet + addresses
   */
  static async createOutlet(req, res) {
    try {
      const {
        name,
        email,
        phone,
        companyName,
        category,
        tanPan,
        gst,
        companyAddress,
        addresses = [],
      } = req.body;

      const createdByUserId = req.user.userId || req.user.id;

      // Check for duplicate email
      const existingEmail = await prisma.outlet.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new UserServiceError(
          `Outlet with email ${email} already exists`,
          "OUTLET_EMAIL_EXISTS",
          409,
        );
      }

      // Check for duplicate phone
      const existingPhone = await prisma.outlet.findUnique({
        where: { phone },
      });

      if (existingPhone) {
        throw new UserServiceError(
          `Outlet with phone ${phone} already exists`,
          "OUTLET_PHONE_EXISTS",
          409,
        );
      }

      // Generate strong temporary password
      const randomPart = crypto.randomBytes(8).toString("hex");
      const temporaryPassword = `Outlet${randomPart}@123!`;

      logger.info("Creating outlet auth user", {
        email,
        createdBy: createdByUserId,
      });

      // Create auth user via API gateway
      let authUser;
      try {
        const authResponse = await axios.post(
          `${API_GATEWAY_URL}/api/v1/users`,
          {
            email,
            password: temporaryPassword,
            firstName: name,
            lastName: "",
            phone,
            role: "outlet",
            isActive: true,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: req.get("Authorization"),
            },
            timeout: 30000,
          },
        );

        authUser = authResponse.data?.data?.user || authResponse.data?.user;
        logger.info("Outlet auth user created", {
          userId: authUser.id,
          email,
        });
      } catch (authError) {
        const authStatus = authError.response?.status;
        const authMessage = authError.response?.data?.error?.message;
        logger.error("Failed to create outlet auth user", {
          error: authError.message,
          response: authError.response?.data,
        });

        if (authStatus === 409) {
          throw new UserServiceError(
            authMessage || `User with email ${email} already exists`,
            "OUTLET_EMAIL_EXISTS",
            409,
          );
        }

        throw new UserServiceError(
          authMessage || "Failed to create outlet user in auth service",
          "AUTH_USER_CREATION_FAILED",
          500,
        );
      }

      // Create outlet and addresses in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create outlet
        const outlet = await tx.outlet.create({
          data: {
            userId: authUser.id,
            createdByUserId,
            name,
            email,
            phone,
            companyName,
            category,
            tanPan,
            gst,
            companyAddress,
            isActive: true,
          },
        });

        // Create addresses if provided
        const createdAddresses = [];
        if (addresses && addresses.length > 0) {
          for (const address of addresses) {
            const createdAddress = await tx.outletAddress.create({
              data: {
                outletId: outlet.id,
                ...address,
              },
            });
            createdAddresses.push(createdAddress);
          }
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: createdByUserId,
            outletId: outlet.id,
            action: "CREATE_OUTLET",
            resource: "Outlet",
            resourceId: outlet.id,
            changes: {
              created: {
                outletId: outlet.id,
                email: outlet.email,
                name: outlet.name,
                addressesCount: createdAddresses.length,
              },
            },
            metadata: {
              source: "user-service",
              endpoint: "/api/outlets",
              createdBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return { outlet, addresses: createdAddresses };
      });

      logger.info("Outlet created successfully", {
        outletId: result.outlet.id,
        email: result.outlet.email,
      });

      // Return outlet with temporary password (only time it's shown)
      res.status(201).json(
        APIResponse.success(
          {
            outlet: result.outlet,
            addresses: result.addresses,
            temporaryPassword,
            message:
              "Outlet created successfully. Please save the temporary password - it will not be shown again.",
          },
          201,
        ),
      );
    } catch (error) {
      logger.error("Create outlet error", {
        error: error.message,
        userId: req.user?.userId,
        requestBody: { ...req.body, temporaryPassword: undefined },
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * List all outlets (superadmin/admin)
   */
  static async listOutlets(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isActive,
        badge,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {
        ...(isActive !== undefined && {
          isActive: isActive === "true" || isActive === true,
        }),
        ...(badge && { badge }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const [outlets, total] = await Promise.all([
        prisma.outlet.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          include: {
            _count: {
              select: { addresses: true },
            },
          },
        }),
        prisma.outlet.count({ where }),
      ]);

      res.json(
        APIResponse.success({
          outlets,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + outlets.length < total,
          },
        }),
      );
    } catch (error) {
      logger.error("List outlets error", {
        error: error.message,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Get outlet by ID (client/admin or outlet itself)
   */
  static async getOutlet(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({
        where: { id },
        include: {
          addresses: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
          },
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      // Check access: outlet can only see own data, client/admin can see all
      if (req.user.role === "outlet" && outlet.userId !== userId) {
        throw new UserServiceError(
          "Access denied",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }

      // Access check removed - superadmin/admin can view all outlets

      res.json(APIResponse.success({ outlet }));
    } catch (error) {
      logger.error("Get outlet error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Get own outlet info (outlet role only)
   */
  static async getMyOutlet(req, res) {
    try {
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({
        where: { userId },
        include: {
          addresses: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      res.json(APIResponse.success({ outlet }));
    } catch (error) {
      logger.error("Get my outlet error", {
        error: error.message,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Update outlet (client/admin or outlet itself for limited fields)
   */
  static async updateOutlet(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId || req.user.id;
      const updateData = req.body;

      // Get existing outlet
      const existingOutlet = await prisma.outlet.findUnique({
        where: { id },
      });

      if (!existingOutlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      // Check access
      if (req.user.role === "outlet" && existingOutlet.userId !== userId) {
        throw new UserServiceError(
          "Access denied",
          "OUTLET_ACCESS_DENIED",
          403,
        );
      }

      // Outlet users can only update limited fields
      if (req.user.role === "outlet") {
        const allowedFields = [
          "phone",
          "companyName",
          "category",
          "tanPan",
          "gst",
          "companyAddress",
        ];
        Object.keys(updateData).forEach((key) => {
          if (!allowedFields.includes(key)) {
            delete updateData[key];
          }
        });
      }

      // Update outlet
      const updatedOutlet = await prisma.$transaction(async (tx) => {
        const updated = await tx.outlet.update({
          where: { id },
          data: updateData,
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            clientId: existingOutlet.clientId,
            outletId: id,
            action: "UPDATE_OUTLET",
            resource: "Outlet",
            resourceId: id,
            changes: {
              before: existingOutlet,
              after: updateData,
            },
            metadata: {
              source: "user-service",
              updatedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updated;
      });

      res.json(
        APIResponse.success({
          outlet: updatedOutlet,
          message: "Outlet updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update outlet error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Get outlet addresses (outlet itself or client/admin)
   */
  static async getAddresses(req, res) {
    try {
      let { outletId } = req.params;
      const userId = req.user.userId || req.user.id;

      // If outlet role, use their own outlet ID
      if (req.user.role === "outlet") {
        const outlet = await prisma.outlet.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!outlet) {
          throw new UserServiceError(
            "Outlet not found",
            "OUTLET_NOT_FOUND",
            404,
          );
        }
        outletId = outlet.id;
      }

      const addresses = await prisma.outletAddress.findMany({
        where: {
          outletId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(APIResponse.success({ addresses }));
    } catch (error) {
      logger.error("Get addresses error", {
        error: error.message,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Create address for outlet
   */
  static async createAddress(req, res) {
    try {
      let { outletId } = req.params;
      const userId = req.user.userId || req.user.id;
      const addressData = req.body;

      // If outlet role, use their own outlet ID
      if (req.user.role === "outlet") {
        const outlet = await prisma.outlet.findUnique({
          where: { userId },
        });
        if (!outlet) {
          throw new UserServiceError(
            "Outlet not found",
            "OUTLET_NOT_FOUND",
            404,
          );
        }
        outletId = outlet.id;
      }

      const address = await prisma.$transaction(async (tx) => {
        // If setting as default, unset other defaults
        if (addressData.isDefaultPickup) {
          await tx.outletAddress.updateMany({
            where: {
              outletId,
              isDefaultPickup: true,
            },
            data: { isDefaultPickup: false },
          });
        }

        if (addressData.isDefaultReturn) {
          await tx.outletAddress.updateMany({
            where: {
              outletId,
              isDefaultReturn: true,
            },
            data: { isDefaultReturn: false },
          });
        }

        const created = await tx.outletAddress.create({
          data: {
            outletId,
            ...addressData,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            outletId,
            action: "CREATE_ADDRESS",
            resource: "OutletAddress",
            resourceId: created.id,
            changes: { created: addressData },
            metadata: {
              source: "user-service",
              createdBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return created;
      });

      res.status(201).json(
        APIResponse.success(
          {
            address,
            message: "Address created successfully",
          },
          201,
        ),
      );
    } catch (error) {
      logger.error("Create address error", {
        error: error.message,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Update address
   */
  static async updateAddress(req, res) {
    try {
      let { outletId, addressId } = req.params;
      const userId = req.user.userId || req.user.id;
      const updateData = req.body;

      // If outlet role, get their outlet ID
      if (req.user.role === "outlet") {
        const outlet = await prisma.outlet.findUnique({
          where: { userId },
        });
        if (!outlet) {
          throw new UserServiceError(
            "Outlet not found",
            "OUTLET_NOT_FOUND",
            404,
          );
        }
        outletId = outlet.id;
      }

      // Verify address belongs to outlet
      const existingAddress = await prisma.outletAddress.findUnique({
        where: { id: addressId },
      });

      if (!existingAddress || existingAddress.outletId !== outletId) {
        throw new UserServiceError(
          "Address not found",
          "ADDRESS_NOT_FOUND",
          404,
        );
      }

      const updatedAddress = await prisma.$transaction(async (tx) => {
        // If setting as default, unset other defaults
        if (updateData.isDefaultPickup) {
          await tx.outletAddress.updateMany({
            where: {
              outletId,
              isDefaultPickup: true,
              id: { not: addressId },
            },
            data: { isDefaultPickup: false },
          });
        }

        if (updateData.isDefaultReturn) {
          await tx.outletAddress.updateMany({
            where: {
              outletId,
              isDefaultReturn: true,
              id: { not: addressId },
            },
            data: { isDefaultReturn: false },
          });
        }

        const updated = await tx.outletAddress.update({
          where: { id: addressId },
          data: updateData,
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            outletId,
            action: "UPDATE_ADDRESS",
            resource: "OutletAddress",
            resourceId: addressId,
            changes: {
              before: existingAddress,
              after: updateData,
            },
            metadata: {
              source: "user-service",
              updatedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updated;
      });

      res.json(
        APIResponse.success({
          address: updatedAddress,
          message: "Address updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update address error", {
        error: error.message,
        addressId: req.params.addressId,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Delete address (soft delete by setting isActive = false)
   */
  static async deleteAddress(req, res) {
    try {
      let { outletId, addressId } = req.params;
      const userId = req.user.userId || req.user.id;

      // If outlet role, get their outlet ID
      if (req.user.role === "outlet") {
        const outlet = await prisma.outlet.findUnique({
          where: { userId },
        });
        if (!outlet) {
          throw new UserServiceError(
            "Outlet not found",
            "OUTLET_NOT_FOUND",
            404,
          );
        }
        outletId = outlet.id;
      }

      // Verify address belongs to outlet
      const existingAddress = await prisma.outletAddress.findUnique({
        where: { id: addressId },
      });

      if (!existingAddress || existingAddress.outletId !== outletId) {
        throw new UserServiceError(
          "Address not found",
          "ADDRESS_NOT_FOUND",
          404,
        );
      }

      await prisma.$transaction(async (tx) => {
        // Hard delete
        await tx.outletAddress.delete({
          where: { id: addressId },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            outletId,
            action: "DELETE_ADDRESS",
            resource: "OutletAddress",
            resourceId: addressId,
            changes: { deleted: existingAddress },
            metadata: {
              source: "user-service",
              deletedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });
      });

      res.json(
        APIResponse.success({
          message: "Address deleted successfully",
        }),
      );
    } catch (error) {
      logger.error("Delete address error", {
        error: error.message,
        addressId: req.params.addressId,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Delete an outlet
   * DELETE /api/outlets/:id
   */
  static async deleteOutlet(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({
        where: { id },
        include: { addresses: true },
      });

      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      await prisma.$transaction(async (tx) => {
        // Soft delete all addresses
        await tx.outletAddress.updateMany({
          where: { outletId: id },
          data: { isActive: false },
        });

        // Soft delete outlet
        await tx.outlet.update({
          where: { id },
          data: { isActive: false },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            outletId: id,
            action: "DELETE_OUTLET",
            resource: "Outlet",
            resourceId: id,
            changes: { deleted: { name: outlet.name, email: outlet.email } },
            metadata: {
              source: "user-service",
              deletedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });
      });

      // Also deactivate the auth user
      try {
        await axios.put(
          `${API_GATEWAY_URL}/api/v1/users/${outlet.userId}/status`,
          { isActive: false },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: req.get("Authorization"),
            },
            timeout: 10000,
          },
        );
      } catch (authError) {
        logger.warn("Failed to deactivate auth user", {
          error: authError.message,
          authUserId: outlet.userId,
        });
      }

      res.json(
        APIResponse.success({
          message: "Outlet deleted successfully",
        }),
      );
    } catch (error) {
      logger.error("Delete outlet error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Toggle outlet active status
   * PATCH /api/outlets/:id/status
   */
  static async toggleOutletStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({
        where: { id },
      });

      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      const updatedOutlet = await prisma.$transaction(async (tx) => {
        const updated = await tx.outlet.update({
          where: { id },
          data: { isActive },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            outletId: id,
            action: isActive ? "ACTIVATE_OUTLET" : "DEACTIVATE_OUTLET",
            resource: "Outlet",
            resourceId: id,
            changes: { isActive: { from: outlet.isActive, to: isActive } },
            metadata: {
              source: "user-service",
              changedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updated;
      });

      // Also update auth user status
      try {
        await axios.put(
          `${API_GATEWAY_URL}/api/v1/users/${outlet.userId}/status`,
          { isActive },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: req.get("Authorization"),
            },
            timeout: 10000,
          },
        );
      } catch (authError) {
        logger.warn("Failed to update auth user status", {
          error: authError.message,
          authUserId: outlet.userId,
        });
      }

      res.json(
        APIResponse.success({
          outlet: updatedOutlet,
          message: `Outlet ${isActive ? "activated" : "deactivated"} successfully`,
        }),
      );
    } catch (error) {
      logger.error("Toggle outlet status error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Update outlet badge
   * PATCH /api/outlets/:id/badge
   */
  static async updateBadge(req, res) {
    try {
      const { id } = req.params;
      const { badge } = req.body;
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({
        where: { id },
      });

      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      const updatedOutlet = await prisma.$transaction(async (tx) => {
        const updated = await tx.outlet.update({
          where: { id },
          data: { badge },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId,
            outletId: id,
            action: "UPDATE_OUTLET_BADGE",
            resource: "Outlet",
            resourceId: id,
            changes: { badge: { from: outlet.badge, to: badge } },
            metadata: {
              source: "user-service",
              changedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updated;
      });

      res.json(
        APIResponse.success({
          outlet: updatedOutlet,
          message: `Outlet badge updated to ${badge} successfully`,
        }),
      );
    } catch (error) {
      logger.error("Update outlet badge error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Update own default markup preference (outlet role).
   * PUT /api/outlets/me/markup
   * Body: { markupType: FLAT|PERCENTAGE|null, markupValue: number|null }
   */
  static async updateMyMarkup(req, res) {
    try {
      const userId = req.user.userId || req.user.id;
      const { markupType, markupValue } = req.body;

      const outlet = await prisma.outlet.findUnique({ where: { userId } });
      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      // Enforce admin caps on the stored default
      if (markupType === "FLAT" && outlet.maxMarkupFlat !== null) {
        if (Number(markupValue) > Number(outlet.maxMarkupFlat)) {
          throw new UserServiceError(
            `Markup exceeds the allowed flat cap of ₹${outlet.maxMarkupFlat}`,
            "MARKUP_CAP_EXCEEDED",
            400,
          );
        }
      }
      if (markupType === "PERCENTAGE" && outlet.maxMarkupPercent !== null) {
        if (Number(markupValue) > Number(outlet.maxMarkupPercent)) {
          throw new UserServiceError(
            `Markup exceeds the allowed percentage cap of ${outlet.maxMarkupPercent}%`,
            "MARKUP_CAP_EXCEEDED",
            400,
          );
        }
      }

      const updatedOutlet = await prisma.$transaction(async (tx) => {
        const updated = await tx.outlet.update({
          where: { id: outlet.id },
          data: {
            defaultMarkupType: markupType ?? null,
            defaultMarkupValue: markupType === null ? null : markupValue,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            outletId: outlet.id,
            action: "UPDATE_OUTLET_MARKUP",
            resource: "Outlet",
            resourceId: outlet.id,
            changes: {
              defaultMarkupType: {
                from: outlet.defaultMarkupType,
                to: markupType ?? null,
              },
              defaultMarkupValue: {
                from: outlet.defaultMarkupValue,
                to: markupType === null ? null : markupValue,
              },
            },
            metadata: { source: "user-service", changedBy: req.user.role },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updated;
      });

      await OutletController.invalidateOutletContextCache(outlet, userId);

      res.json(
        APIResponse.success({
          outlet: updatedOutlet,
          message: "Markup preference updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update outlet markup error", {
        error: error.message,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Update markup caps for an outlet (admin/client).
   * PUT /api/outlets/:id/markup-limits
   * Body: { maxMarkupFlat: number|null, maxMarkupPercent: number|null }
   */
  static async updateMarkupLimits(req, res) {
    try {
      const { id } = req.params;
      const { maxMarkupFlat, maxMarkupPercent } = req.body;
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({ where: { id } });
      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      const updatedOutlet = await prisma.$transaction(async (tx) => {
        const updated = await tx.outlet.update({
          where: { id },
          data: {
            maxMarkupFlat: maxMarkupFlat ?? null,
            maxMarkupPercent: maxMarkupPercent ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            outletId: id,
            action: "UPDATE_OUTLET_MARKUP_LIMITS",
            resource: "Outlet",
            resourceId: id,
            changes: {
              maxMarkupFlat: {
                from: outlet.maxMarkupFlat,
                to: maxMarkupFlat ?? null,
              },
              maxMarkupPercent: {
                from: outlet.maxMarkupPercent,
                to: maxMarkupPercent ?? null,
              },
            },
            metadata: { source: "user-service", changedBy: req.user.role },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updated;
      });

      await OutletController.invalidateOutletContextCache(
        outlet,
        outlet.userId,
      );

      res.json(
        APIResponse.success({
          outlet: updatedOutlet,
          message: "Markup limits updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update outlet markup limits error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }

  /**
   * Best-effort invalidation of shipment-service's cached outlet context
   * (shared Redis) so markup changes take effect without waiting for TTL.
   */
  static async invalidateOutletContextCache(outlet, userId) {
    try {
      const { getRedisClient } = require("../config/redis");
      const redis = getRedisClient();
      await redis.del(
        `shipment-outlet-wallet:user:${userId}`,
        `shipment-outlet-wallet:outlet:${outlet.id}`,
      );
    } catch (error) {
      logger.warn("Failed to invalidate outlet context cache", {
        error: error.message,
        outletId: outlet.id,
      });
    }
  }

  /**
   * Reset outlet password
   * POST /api/outlets/:id/reset-password
   */
  static async resetOutletPassword(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId || req.user.id;

      const outlet = await prisma.outlet.findUnique({
        where: { id },
      });

      if (!outlet) {
        throw new UserServiceError("Outlet not found", "OUTLET_NOT_FOUND", 404);
      }

      // Generate new password
      const randomPart = crypto.randomBytes(8).toString("hex");
      const newPassword = `Outlet${randomPart}@123!`;

      // Update password in auth service
      try {
        await axios.post(
          `${API_GATEWAY_URL}/api/v1/users/${outlet.userId}/reset-password`,
          { password: newPassword },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: req.get("Authorization"),
            },
            timeout: 10000,
          },
        );
      } catch (authError) {
        logger.error("Failed to reset password in auth service", {
          error: authError.message,
          status: authError.response?.status,
          response: authError.response?.data,
        });
        const authStatus = authError.response?.status;
        const authMessage =
          authError.response?.data?.error?.message ||
          authError.response?.data?.message;
        throw new UserServiceError(
          authMessage || "Failed to reset password",
          "PASSWORD_RESET_FAILED",
          authStatus && authStatus >= 400 && authStatus < 500
            ? authStatus
            : 500,
        );
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          outletId: id,
          action: "RESET_PASSWORD",
          resource: "Outlet",
          resourceId: id,
          changes: { passwordReset: true },
          metadata: {
            source: "user-service",
            resetBy: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(
        APIResponse.success({
          temporaryPassword: newPassword,
          message:
            "Password reset successfully. Please save this password - it will not be shown again.",
        }),
      );
    } catch (error) {
      logger.error("Reset outlet password error", {
        error: error.message,
        outletId: req.params.id,
        userId: req.user?.userId,
      });
      const statusCode = error.statusCode || 500;
      const code = error.code || "INTERNAL_ERROR";
      res
        .status(statusCode)
        .json(APIResponse.error(error.message, statusCode, code));
    }
  }
}

module.exports = OutletController;
