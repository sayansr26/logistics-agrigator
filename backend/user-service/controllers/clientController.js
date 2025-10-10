// Client Controller - Multi-tenant client management
// Handles client CRUD operations, settings, and user associations

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { authUtils } = require("../shared/lib/auth");
const {
  ClientNotFoundError,
  UserServiceError,
} = require("../middleware/errorHandler");

const prisma = new PrismaClient();

class ClientController {
  // Create a new client
  static async createClient(req, res) {
    try {
      const {
        name,
        slug,
        domain,
        contactEmail,
        contactPhone,
        businessType,
        industry,
        companySize,
        address,
        isActive = true,
        subscriptionTier = "basic",
      } = req.body;

      // Check if slug already exists
      const existingClient = await prisma.client.findUnique({
        where: { slug },
      });

      if (existingClient) {
        throw new UserServiceError(
          `Client with slug '${slug}' already exists`,
          "CLIENT_SLUG_EXISTS",
          409,
        );
      }

      // Check if domain already exists (if provided)
      if (domain) {
        const existingDomain = await prisma.client.findUnique({
          where: { domain },
        });

        if (existingDomain) {
          throw new UserServiceError(
            `Client with domain '${domain}' already exists`,
            "CLIENT_DOMAIN_EXISTS",
            409,
          );
        }
      }

      // Create client with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        // Create the client
        const client = await tx.client.create({
          data: {
            name,
            slug,
            domain,
            contactEmail,
            contactPhone,
            businessType,
            industry,
            companySize,
            address,
            isActive,
            subscriptionTier,
          },
          include: {
            clientSettings: true,
            _count: {
              select: {
                userProfiles: true,
                userInvitations: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: client.id,
            action: "CREATE_CLIENT",
            resource: "Client",
            resourceId: client.id,
            changes: {
              created: {
                name: client.name,
                slug: client.slug,
                domain: client.domain,
                contactEmail: client.contactEmail,
                subscriptionTier: client.subscriptionTier,
              },
            },
            metadata: {
              source: "user-service",
              endpoint: "/api/clients",
              createdBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return client;
      });

      logger.info("Client created successfully", {
        clientId: result.id,
        slug: result.slug,
        createdBy: req.user.userId,
        service: "user-service",
      });

      res.status(201).json(
        APIResponse.success(
          {
            client: result,
            message: "Client created successfully",
          },
          201,
        ),
      );
    } catch (error) {
      logger.error("Create client error", {
        error: error.message,
        userId: req.user.userId,
        requestBody: req.body,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get all clients with pagination and filtering
  static async listClients(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        isActive,
        subscriptionTier,
        industry,
        startDate,
        endDate,
      } = req.query;

      const skip = (page - 1) * limit;

      // Build where clause with scope filtering
      let where = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { contactEmail: { contains: search, mode: "insensitive" } },
          { businessType: { contains: search, mode: "insensitive" } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      if (subscriptionTier) {
        where.subscriptionTier = subscriptionTier;
      }

      if (industry) {
        where.industry = industry;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Apply RBAC scope filtering
      where = authUtils.applyScopeFilter(req, where);

      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { [sortBy]: sortOrder },
          include: {
            clientSettings: {
              select: {
                brandName: true,
                logo: true,
                primaryColor: true,
              },
            },
            _count: {
              select: {
                userProfiles: true,
                userInvitations: true,
              },
            },
          },
        }),
        prisma.client.count({ where }),
      ]);

      // Create audit log for list access
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "LIST_CLIENTS",
          resource: "Client",
          metadata: {
            source: "user-service",
            endpoint: "/api/clients",
            filters: { search, isActive, subscriptionTier, industry },
            pagination: { page, limit },
            resultCount: clients.length,
            totalCount: total,
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const hasMore = skip + clients.length < total;
      const totalPages = Math.ceil(total / limit);

      res.json(
        APIResponse.success({
          clients,
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
            subscriptionTier,
            industry,
            startDate,
            endDate,
          },
        }),
      );
    } catch (error) {
      logger.error("List clients error", {
        error: error.message,
        userId: req.user.userId,
        query: req.query,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get a specific client by ID
  static async getClient(req, res) {
    try {
      const { id } = req.params;

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.role !== "support" &&
        req.user.clientId !== id
      ) {
        throw new UserServiceError(
          "Access denied. You can only view your own client information.",
          "CLIENT_ACCESS_DENIED",
          403,
        );
      }

      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          clientSettings: true,
          userProfiles: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              isActive: true,
              isVerified: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          userInvitations: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              invitedBy: true,
              createdAt: true,
              expiresAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              userProfiles: true,
              userInvitations: true,
            },
          },
        },
      });

      if (!client) {
        throw new ClientNotFoundError(id);
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          clientId: client.id,
          action: "GET_CLIENT",
          resource: "Client",
          resourceId: client.id,
          metadata: {
            source: "user-service",
            endpoint: `/api/clients/${id}`,
            requestingRole: req.user.role,
            includeDetails: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ client }));
    } catch (error) {
      logger.error("Get client error", {
        error: error.message,
        clientId: req.params.id,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Update a client
  static async updateClient(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Role-based access control
      if (req.user.role !== "admin" && req.user.clientId !== id) {
        throw new UserServiceError(
          "Access denied. You can only update your own client information.",
          "CLIENT_UPDATE_DENIED",
          403,
        );
      }

      // Get current client for audit trail
      const currentClient = await prisma.client.findUnique({
        where: { id },
      });

      if (!currentClient) {
        throw new ClientNotFoundError(id);
      }

      // Check for slug conflicts (if updating slug)
      if (updateData.slug && updateData.slug !== currentClient.slug) {
        const existingSlug = await prisma.client.findUnique({
          where: { slug: updateData.slug },
        });

        if (existingSlug) {
          throw new UserServiceError(
            `Client with slug '${updateData.slug}' already exists`,
            "CLIENT_SLUG_EXISTS",
            409,
          );
        }
      }

      // Check for domain conflicts (if updating domain)
      if (updateData.domain && updateData.domain !== currentClient.domain) {
        const existingDomain = await prisma.client.findUnique({
          where: { domain: updateData.domain },
        });

        if (existingDomain) {
          throw new UserServiceError(
            `Client with domain '${updateData.domain}' already exists`,
            "CLIENT_DOMAIN_EXISTS",
            409,
          );
        }
      }

      // Update client with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const updatedClient = await tx.client.update({
          where: { id },
          data: updateData,
          include: {
            clientSettings: true,
            _count: {
              select: {
                userProfiles: true,
                userInvitations: true,
              },
            },
          },
        });

        // Create audit log with before/after changes
        const changes = {};
        Object.keys(updateData).forEach((key) => {
          if (currentClient[key] !== updateData[key]) {
            changes[key] = {
              before: currentClient[key],
              after: updateData[key],
            };
          }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: updatedClient.id,
            action: "UPDATE_CLIENT",
            resource: "Client",
            resourceId: updatedClient.id,
            changes,
            metadata: {
              source: "user-service",
              endpoint: `/api/clients/${id}`,
              updatedBy: req.user.role,
              fieldsUpdated: Object.keys(updateData),
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updatedClient;
      });

      logger.info("Client updated successfully", {
        clientId: result.id,
        updatedFields: Object.keys(updateData),
        updatedBy: req.user.userId,
        service: "user-service",
      });

      res.json(
        APIResponse.success({
          client: result,
          message: "Client updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update client error", {
        error: error.message,
        clientId: req.params.id,
        userId: req.user.userId,
        updateData: req.body,
        service: "user-service",
      });
      throw error;
    }
  }

  // Soft delete a client (deactivate)
  static async deleteClient(req, res) {
    try {
      const { id } = req.params;

      // Only admins can delete clients
      if (req.user.role !== "admin") {
        throw new UserServiceError(
          "Access denied. Only administrators can delete clients.",
          "CLIENT_DELETE_DENIED",
          403,
        );
      }

      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              userProfiles: true,
              userInvitations: true,
            },
          },
        },
      });

      if (!client) {
        throw new ClientNotFoundError(id);
      }

      // Soft delete by deactivating
      const result = await prisma.$transaction(async (tx) => {
        const deactivatedClient = await tx.client.update({
          where: { id },
          data: { isActive: false },
        });

        // Also deactivate all user profiles for this client
        await tx.userProfile.updateMany({
          where: { clientId: id },
          data: { isActive: false },
        });

        // Cancel all pending invitations
        await tx.userInvitation.updateMany({
          where: {
            clientId: id,
            status: "pending",
          },
          data: { status: "cancelled" },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: id,
            action: "DELETE_CLIENT",
            resource: "Client",
            resourceId: id,
            changes: {
              deactivated: {
                isActive: { before: true, after: false },
                userProfilesAffected: client._count.userProfiles,
                invitationsCancelled: client._count.userInvitations,
              },
            },
            metadata: {
              source: "user-service",
              endpoint: `/api/clients/${id}`,
              deletedBy: req.user.role,
              softDelete: true,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return deactivatedClient;
      });

      logger.warn("Client deactivated", {
        clientId: id,
        clientName: client.name,
        userProfilesAffected: client._count.userProfiles,
        deletedBy: req.user.userId,
        service: "user-service",
      });

      res.json(
        APIResponse.success({
          message: "Client deactivated successfully",
          client: {
            id: result.id,
            name: result.name,
            isActive: result.isActive,
          },
          impact: {
            userProfilesDeactivated: client._count.userProfiles,
            invitationsCancelled: client._count.userInvitations,
          },
        }),
      );
    } catch (error) {
      logger.error("Delete client error", {
        error: error.message,
        clientId: req.params.id,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get client statistics
  static async getClientStats(req, res) {
    try {
      // Role-based access control
      if (req.user.role !== "admin" && req.user.role !== "support") {
        throw new UserServiceError(
          "Access denied. Only administrators and support can view client statistics.",
          "CLIENT_STATS_DENIED",
          403,
        );
      }

      const stats = await prisma.$transaction(async (tx) => {
        const [
          totalClients,
          activeClients,
          clientsByTier,
          clientsByIndustry,
          recentClients,
          topClientsByUsers,
        ] = await Promise.all([
          tx.client.count(),
          tx.client.count({ where: { isActive: true } }),
          tx.client.groupBy({
            by: ["subscriptionTier"],
            _count: { id: true },
          }),
          tx.client.groupBy({
            by: ["industry"],
            _count: { id: true },
            where: { industry: { not: null } },
          }),
          tx.client.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              slug: true,
              subscriptionTier: true,
              createdAt: true,
            },
          }),
          tx.client.findMany({
            take: 10,
            select: {
              id: true,
              name: true,
              slug: true,
              _count: {
                select: { userProfiles: true },
              },
            },
            orderBy: {
              userProfiles: { _count: "desc" },
            },
          }),
        ]);

        return {
          overview: {
            totalClients,
            activeClients,
            inactiveClients: totalClients - activeClients,
          },
          subscriptionTiers: clientsByTier.reduce((acc, tier) => {
            acc[tier.subscriptionTier] = tier._count.id;
            return acc;
          }, {}),
          industries: clientsByIndustry.reduce((acc, industry) => {
            acc[industry.industry] = industry._count.id;
            return acc;
          }, {}),
          recentClients,
          topClientsByUsers,
        };
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "GET_CLIENT_STATS",
          resource: "Client",
          metadata: {
            source: "user-service",
            endpoint: "/api/clients/stats",
            requestingRole: req.user.role,
            statsGenerated: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ stats }));
    } catch (error) {
      logger.error("Get client stats error", {
        error: error.message,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Activate/Reactivate a client (admin only)
  static async activateClient(req, res) {
    try {
      const { id } = req.params;
      const { isActive = true } = req.body;

      // Only admins can activate/deactivate clients
      if (req.user.role !== "admin") {
        throw new UserServiceError(
          "Access denied. Only administrators can activate/deactivate clients.",
          "CLIENT_ACTIVATION_DENIED",
          403,
        );
      }

      const client = await prisma.client.findUnique({
        where: { id },
      });

      if (!client) {
        throw new ClientNotFoundError(id);
      }

      if (client.isActive === isActive) {
        return res.json(
          APIResponse.success({
            message: `Client is already ${isActive ? "active" : "inactive"}`,
            client: {
              id: client.id,
              name: client.name,
              isActive: client.isActive,
            },
          }),
        );
      }

      // Update client activation status
      const result = await prisma.$transaction(async (tx) => {
        const updatedClient = await tx.client.update({
          where: { id },
          data: { isActive },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: id,
            action: isActive ? "ACTIVATE_CLIENT" : "DEACTIVATE_CLIENT",
            resource: "Client",
            resourceId: id,
            changes: {
              isActive: {
                before: client.isActive,
                after: isActive,
              },
            },
            metadata: {
              source: "user-service",
              endpoint: `/api/clients/${id}/activate`,
              activatedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updatedClient;
      });

      logger.info(`Client ${isActive ? "activated" : "deactivated"}`, {
        clientId: id,
        clientName: client.name,
        activatedBy: req.user.userId,
        service: "user-service",
      });

      res.json(
        APIResponse.success({
          message: `Client ${isActive ? "activated" : "deactivated"} successfully`,
          client: {
            id: result.id,
            name: result.name,
            isActive: result.isActive,
          },
        }),
      );
    } catch (error) {
      logger.error("Activate client error", {
        error: error.message,
        clientId: req.params.id,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get all users for a specific client
  static async getClientUsers(req, res) {
    try {
      const { clientId } = req.params;

      // Role-based access control is handled by middleware
      // Add clientId to query for filtering
      req.query.clientId = clientId;

      // Import UserController here to avoid circular dependency
      const UserController = require("./userController");
      return UserController.listProfiles(req, res);
    } catch (error) {
      logger.error("Get client users error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get all invitations for a specific client
  static async getClientInvitations(req, res) {
    try {
      const { clientId } = req.params;

      // Role-based access control is handled by middleware
      // Add clientId to query for filtering
      req.query.clientId = clientId;

      // Import UserInvitationController here to avoid circular dependency
      const UserInvitationController = require("./userInvitationController");
      return UserInvitationController.listInvitations(req, res);
    } catch (error) {
      logger.error("Get client invitations error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get comprehensive statistics for a specific client
  static async getClientDetailedStats(req, res) {
    try {
      const { clientId } = req.params;

      // Role-based access control is handled by middleware
      const { PrismaClient } = require("@prisma/client");
      const APIResponse = require("../shared/lib/response");

      const prisma = new PrismaClient();

      // Get combined stats for the client
      const [userStats, invitationStats, clientInfo] = await Promise.all([
        // User profile stats for this client
        prisma.$transaction(async (tx) => {
          const [totalUsers, activeUsers, verifiedUsers] = await Promise.all([
            tx.userProfile.count({ where: { clientId } }),
            tx.userProfile.count({ where: { clientId, isActive: true } }),
            tx.userProfile.count({ where: { clientId, isVerified: true } }),
          ]);

          return { totalUsers, activeUsers, verifiedUsers };
        }),

        // Invitation stats for this client
        prisma.$transaction(async (tx) => {
          const [totalInvitations, pendingInvitations, acceptedInvitations] =
            await Promise.all([
              tx.userInvitation.count({ where: { clientId } }),
              tx.userInvitation.count({
                where: { clientId, status: "pending" },
              }),
              tx.userInvitation.count({
                where: { clientId, status: "accepted" },
              }),
            ]);

          return { totalInvitations, pendingInvitations, acceptedInvitations };
        }),

        // Client basic info
        prisma.client.findUnique({
          where: { id: clientId },
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionTier: true,
            isActive: true,
            createdAt: true,
          },
        }),
      ]);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          clientId,
          action: "GET_CLIENT_DETAILED_STATS",
          resource: "Client",
          resourceId: clientId,
          metadata: {
            source: "user-service",
            endpoint: `/api/clients/${clientId}/stats`,
            requestingRole: req.user.role,
            statsGenerated: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const combinedStats = {
        client: clientInfo,
        users: userStats,
        invitations: invitationStats,
        summary: {
          totalMembers: userStats.totalUsers,
          activeMembers: userStats.activeUsers,
          pendingInvitations: invitationStats.pendingInvitations,
          membershipRate:
            userStats.totalUsers > 0
              ? Math.round(
                  (userStats.verifiedUsers / userStats.totalUsers) * 100,
                )
              : 0,
        },
      };

      logger.info("Client detailed stats retrieved", {
        clientId,
        requestedBy: req.user.userId,
        statsGenerated: true,
        service: "user-service",
      });

      res.json(APIResponse.success({ stats: combinedStats }));
    } catch (error) {
      logger.error("Get client detailed stats error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  /**
   * RBAC-003: Register new client with auto-license generation and Docker image build
   * Super admin only - Creates client, generates license, builds secure Docker image
   */
  static async registerClient(req, res) {
    const axios = require("axios");
    const crypto = require("crypto");
    const licenseServiceClient = require("../services/licenseServiceClient");
    const dockerBuilderClient = require("../services/dockerBuilderClient");

    try {
      const {
        name,
        email,
        contactPerson,
        licenseType = "STANDARD",
        services = [
          "auth-service",
          "user-service",
          "api-gateway",
          "shipment-service",
          "partner-service",
          "wallet-service",
        ],
        registry = "docker.io/logistics-secure",
        enableMonitoring = false,
      } = req.body;

      // SUPER ADMIN ONLY
      if (req.user.role !== "superadmin") {
        throw new UserServiceError(
          "Access denied. Only super administrators can register new clients.",
          "CLIENT_REGISTRATION_DENIED",
          403,
        );
      }

      logger.info("Starting client registration", {
        name,
        email,
        licenseType,
        services: services.length,
        registeredBy: req.user.userId,
      });

      // Generate slug from name
      const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      // Check if slug already exists
      const existingClient = await prisma.client.findUnique({
        where: { slug },
      });
      if (existingClient) {
        throw new UserServiceError(
          `Client with slug '${slug}' already exists`,
          "CLIENT_SLUG_EXISTS",
          409,
        );
      }

      // Generate temporary password for admin user (meets all validation requirements)
      // Pattern: Uppercase + lowercase + numbers + special chars
      const randomPart = crypto.randomBytes(8).toString("hex"); // Lowercase hex chars
      const temporaryPassword = `Temp${randomPart}@123!`; // Meets: Upper, lower, number, special

      let client, license, buildResult, adminUser;
      let rollbackNeeded = false;

      try {
        // STEP 1: Create Client record
        logger.info("Creating client record", { slug });

        client = await prisma.client.create({
          data: {
            name,
            slug,
            contactEmail: email,
            clientType: "LICENSE_BASED",
            licenseStatus: "INACTIVE",
            isActive: true,
            subscriptionTier: "enterprise",
          },
        });

        rollbackNeeded = true;
        logger.info("Client created", { clientId: client.id });

        // STEP 2: Create admin user in auth-service
        logger.info("Creating admin user in auth-service", { email });

        const authServiceUrl =
          process.env.AUTH_SERVICE_URL || "http://auth-service:3002";
        try {
          const authResponse = await axios.post(
            `${authServiceUrl}/auth/register`,
            {
              email,
              password: temporaryPassword,
              name: contactPerson || name, // Use contactPerson if provided, otherwise client name
              role: "client",
              clientId: client.id,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`,
              },
              timeout: 30000,
            },
          );

          adminUser = authResponse.data?.data?.user || authResponse.data?.user;
          logger.info("Admin user created", { userId: adminUser.id, email });
        } catch (authError) {
          logger.error("Failed to create admin user", {
            error: authError.message,
            response: authError.response?.data,
          });
          throw new UserServiceError(
            "Failed to create admin user in auth service",
            "ADMIN_USER_CREATION_FAILED",
            500,
          );
        }

        // STEP 3: Generate license via license-service
        logger.info("Generating license", { clientId: client.id, licenseType });

        license = await licenseServiceClient.generateLicense(
          {
            clientId: client.id,
            type: licenseType,
            plan: licenseType === "TRIAL" ? "MONTHLY" : "YEARLY",
            allowedServices: services,
            maxActivations: licenseType === "ENTERPRISE" ? 5 : 1,
            validityDays: licenseType === "TRIAL" ? 14 : 365,
            features: {
              enableMonitoring,
              services,
            },
            limits: {
              maxUsers: licenseType === "ENTERPRISE" ? 100 : 25,
              maxShipments: licenseType === "ENTERPRISE" ? 100000 : 10000,
            },
          },
          req.headers.authorization?.split(" ")[1],
        );

        logger.info("License generated", {
          licenseId: license.id,
          validUntil: license.validUntil,
        });

        // STEP 4: Update client with license information
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            licenseId: license.id,
            activationCode: license.key,
            licenseValidUntil: new Date(license.validUntil),
            licenseStatus: "ACTIVE",
          },
        });

        logger.info("Client updated with license", { clientId: client.id });

        // STEP 5: Trigger secure Docker image build (optional for Phase 1)
        logger.info("Triggering Docker build", { clientId: client.id });

        try {
          buildResult = await dockerBuilderClient.triggerBuild({
            clientId: client.id,
            clientName: name,
            licenseType,
            services,
            registry,
            licenseServer:
              process.env.LICENSE_SERVICE_URL || "http://localhost:3011",
            enableMonitoring,
            secretKey: crypto.randomBytes(32).toString("hex"),
          });

          logger.info("Docker build completed", {
            imageName: buildResult.imageName,
            size: buildResult.size,
          });

          // STEP 6: Update client with Docker image info
          client = await prisma.client.update({
            where: { id: client.id },
            data: {
              dockerImageTag: buildResult.tag,
              deployedAt: new Date(),
            },
          });
        } catch (dockerError) {
          logger.warn("Docker build skipped (builder not available)", {
            clientId: client.id,
            error: dockerError.message,
          });

          // Create mock build result for Phase 1
          buildResult = {
            success: false,
            imageName: `logistics/secure-${client.id}:pending`,
            registry,
            tag: "pending-build",
            buildStatus: "pending",
            error: "Docker builder not configured",
            timestamp: new Date().toISOString(),
            size: "N/A",
          };
        }

        // STEP 7: Create audit log
        await prisma.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: client.id,
            action: "REGISTER_CLIENT",
            resource: "Client",
            resourceId: client.id,
            changes: {
              created: {
                name: client.name,
                slug: client.slug,
                licenseType,
                licenseId: license.id,
                dockerImage: buildResult.imageName,
              },
            },
            metadata: {
              source: "user-service",
              endpoint: "/api/v1/clients/register",
              registeredBy: req.user.role,
              services,
              enableMonitoring,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        // STEP 8: Generate deployment instructions
        const deploymentInstructions =
          dockerBuilderClient.generateDeploymentInstructions(
            buildResult,
            { id: client.id, name: client.name, email, licenseType },
            license.key,
          );

        logger.info("Client registration completed successfully", {
          clientId: client.id,
          licenseId: license.id,
          imageName: buildResult.imageName,
        });

        // Return deployment package
        res.status(201).json(
          APIResponse.success(
            {
              client: {
                id: client.id,
                name: client.name,
                slug: client.slug,
                clientType: client.clientType,
                licenseStatus: client.licenseStatus,
              },
              license: {
                id: license.id,
                key: license.key,
                type: license.type,
                validUntil: license.validUntil,
                maxActivations: license.maxActivations,
              },
              deployment: {
                imageName: buildResult.imageName,
                registry: buildResult.registry,
                tag: buildResult.tag,
                buildStatus: buildResult.buildStatus,
                size: buildResult.size,
              },
              credentials: {
                adminEmail: email,
                temporaryPassword,
              },
              instructions: deploymentInstructions,
            },
            201,
          ),
        );
      } catch (stepError) {
        logger.error("Client registration failed", {
          error: stepError.message,
          clientId: client?.id,
          rollbackNeeded,
        });

        // Rollback: Delete client if created
        if (rollbackNeeded && client) {
          try {
            await prisma.client.delete({ where: { id: client.id } });
            logger.info("Client rollback successful", { clientId: client.id });
          } catch (rollbackError) {
            logger.error("Client rollback failed", {
              clientId: client.id,
              error: rollbackError.message,
            });
          }
        }

        throw stepError;
      }
    } catch (error) {
      logger.error("Client registration error", {
        error: error.message,
        userId: req.user?.userId,
        requestBody: req.body,
      });
      throw error;
    }
  }
}

module.exports = ClientController;
