// User Service - User Profile Controller
// Handles CRUD operations for user profiles with complete audit logging
// Follows auth-service patterns and uses Prisma transactions

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const {
  UserServiceError,
  ProfileNotFoundError,
  ClientNotFoundError,
} = require("../middleware/errorHandler");

const prisma = new PrismaClient();

class UserController {
  // Create user profile
  static async createProfile(req, res) {
    try {
      const {
        firstName,
        lastName,
        phoneNumber,
        companyName,
        designation,
        department,
        address,
        billingAddress,
        preferences,
        timezone,
        language,
        clientId,
      } = req.body;

      const userId = req.user.userId;

      // Check if profile already exists
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId },
      });

      if (existingProfile) {
        throw new UserServiceError(
          "User profile already exists",
          "PROFILE_EXISTS",
          409,
        );
      }

      // Validate client exists if provided
      if (clientId) {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
        });

        if (!client) {
          throw new ClientNotFoundError(clientId);
        }

        if (!client.isActive) {
          throw new UserServiceError(
            "Cannot associate with inactive client",
            "CLIENT_INACTIVE",
            400,
          );
        }
      }

      // Create profile with audit logging in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the profile
        const profile = await tx.userProfile.create({
          data: {
            userId,
            firstName,
            lastName,
            phoneNumber,
            companyName,
            designation,
            department,
            address,
            billingAddress,
            preferences,
            timezone,
            language: language || "en",
            clientId,
            profileComplete: true,
            isVerified: false,
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId,
            userProfileId: profile.id,
            clientId,
            action: "CREATE_PROFILE",
            resource: "UserProfile",
            resourceId: profile.id,
            changes: {
              created: {
                firstName,
                lastName,
                companyName,
                clientId,
              },
            },
            metadata: {
              source: "user-service",
              userAgent: req.get("User-Agent"),
              profileComplete: true,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            requestId: req.id,
          },
        });

        return profile;
      });

      logger.info("User profile created successfully", {
        userId,
        profileId: result.id,
        clientId,
        service: "user-service",
      });

      res.status(201).json(
        APIResponse.success(
          {
            profile: {
              id: result.id,
              userId: result.userId,
              firstName: result.firstName,
              lastName: result.lastName,
              phoneNumber: result.phoneNumber,
              companyName: result.companyName,
              designation: result.designation,
              department: result.department,
              address: result.address,
              billingAddress: result.billingAddress,
              preferences: result.preferences,
              timezone: result.timezone,
              language: result.language,
              isActive: result.isActive,
              isVerified: result.isVerified,
              profileComplete: result.profileComplete,
              clientId: result.clientId,
              client: result.client,
              createdAt: result.createdAt,
              updatedAt: result.updatedAt,
            },
          },
          {
            service: "user-service",
            action: "create_profile",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to create user profile", {
        error: error.message,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get user profile by ID
  static async getProfile(req, res) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.userId;

      const profile = await prisma.userProfile.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              subscriptionTier: true,
            },
          },
        },
      });

      if (!profile) {
        throw new ProfileNotFoundError(id);
      }

      // Check access permissions
      const canAccess =
        req.user.role === "admin" ||
        req.user.role === "support" ||
        profile.userId === requestingUserId ||
        (req.user.clientId && req.user.clientId === profile.clientId);

      if (!canAccess) {
        throw new UserServiceError(
          "Access denied to this profile",
          "PROFILE_ACCESS_DENIED",
          403,
        );
      }

      // Create audit log for profile access
      await prisma.auditLog.create({
        data: {
          userId: requestingUserId,
          userProfileId: profile.id,
          clientId: profile.clientId,
          action: "VIEW_PROFILE",
          resource: "UserProfile",
          resourceId: profile.id,
          metadata: {
            source: "user-service",
            accessType: "profile_view",
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          requestId: req.id,
        },
      });

      res.json(
        APIResponse.success(
          {
            profile: {
              id: profile.id,
              userId: profile.userId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              phoneNumber: profile.phoneNumber,
              companyName: profile.companyName,
              designation: profile.designation,
              department: profile.department,
              address: profile.address,
              billingAddress: profile.billingAddress,
              preferences: profile.preferences,
              timezone: profile.timezone,
              language: profile.language,
              isActive: profile.isActive,
              isVerified: profile.isVerified,
              profileComplete: profile.profileComplete,
              clientId: profile.clientId,
              client: profile.client,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
              lastLoginAt: profile.lastLoginAt,
            },
          },
          {
            service: "user-service",
            action: "get_profile",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to get user profile", {
        error: error.message,
        profileId: req.params.id,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get current user's profile
  static async getMyProfile(req, res) {
    try {
      const userId = req.user.userId;

      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              subscriptionTier: true,
            },
          },
        },
      });

      if (!profile) {
        return res.json(
          APIResponse.success(
            {
              profile: null,
              hasProfile: false,
              message: "No profile found. Please create your profile.",
            },
            {
              service: "user-service",
              action: "get_my_profile",
            },
          ),
        );
      }

      // Update last login time
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { lastLoginAt: new Date() },
      });

      res.json(
        APIResponse.success(
          {
            profile: {
              id: profile.id,
              userId: profile.userId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              phoneNumber: profile.phoneNumber,
              companyName: profile.companyName,
              designation: profile.designation,
              department: profile.department,
              address: profile.address,
              billingAddress: profile.billingAddress,
              preferences: profile.preferences,
              timezone: profile.timezone,
              language: profile.language,
              isActive: profile.isActive,
              isVerified: profile.isVerified,
              profileComplete: profile.profileComplete,
              clientId: profile.clientId,
              client: profile.client,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
              lastLoginAt: new Date(),
            },
            hasProfile: true,
          },
          {
            service: "user-service",
            action: "get_my_profile",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to get current user profile", {
        error: error.message,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.userId;
      const updateData = req.body;

      // Get existing profile
      const existingProfile = await prisma.userProfile.findUnique({
        where: { id },
        include: {
          client: true,
        },
      });

      if (!existingProfile) {
        throw new ProfileNotFoundError(id);
      }

      // Check access permissions
      const canUpdate =
        req.user.role === "admin" ||
        existingProfile.userId === requestingUserId ||
        (req.user.role === "operations" &&
          req.user.clientId === existingProfile.clientId);

      if (!canUpdate) {
        throw new UserServiceError(
          "Access denied to update this profile",
          "PROFILE_UPDATE_DENIED",
          403,
        );
      }

      // Validate client change if provided
      if (
        updateData.clientId &&
        updateData.clientId !== existingProfile.clientId
      ) {
        if (req.user.role !== "admin") {
          throw new UserServiceError(
            "Only admin can change client association",
            "CLIENT_CHANGE_DENIED",
            403,
          );
        }

        const newClient = await prisma.client.findUnique({
          where: { id: updateData.clientId },
        });

        if (!newClient || !newClient.isActive) {
          throw new ClientNotFoundError(updateData.clientId);
        }
      }

      // Update profile with audit logging in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Track changes for audit
        const changes = {
          before: {},
          after: {},
        };

        Object.keys(updateData).forEach((key) => {
          if (existingProfile[key] !== updateData[key]) {
            changes.before[key] = existingProfile[key];
            changes.after[key] = updateData[key];
          }
        });

        // Update the profile
        const updatedProfile = await tx.userProfile.update({
          where: { id },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                subscriptionTier: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            userProfileId: updatedProfile.id,
            clientId: updatedProfile.clientId,
            action: "UPDATE_PROFILE",
            resource: "UserProfile",
            resourceId: updatedProfile.id,
            changes,
            metadata: {
              source: "user-service",
              updatedBy: requestingUserId,
              updatedByRole: req.user.role,
              fieldsUpdated: Object.keys(updateData),
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            requestId: req.id,
          },
        });

        return updatedProfile;
      });

      logger.info("User profile updated successfully", {
        profileId: id,
        updatedBy: requestingUserId,
        fieldsUpdated: Object.keys(updateData),
        service: "user-service",
      });

      res.json(
        APIResponse.success(
          {
            profile: {
              id: result.id,
              userId: result.userId,
              firstName: result.firstName,
              lastName: result.lastName,
              phoneNumber: result.phoneNumber,
              companyName: result.companyName,
              designation: result.designation,
              department: result.department,
              address: result.address,
              billingAddress: result.billingAddress,
              preferences: result.preferences,
              timezone: result.timezone,
              language: result.language,
              isActive: result.isActive,
              isVerified: result.isVerified,
              profileComplete: result.profileComplete,
              clientId: result.clientId,
              client: result.client,
              createdAt: result.createdAt,
              updatedAt: result.updatedAt,
            },
          },
          {
            service: "user-service",
            action: "update_profile",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to update user profile", {
        error: error.message,
        profileId: req.params.id,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Delete user profile (soft delete)
  static async deleteProfile(req, res) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.userId;

      // Get existing profile
      const existingProfile = await prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existingProfile) {
        throw new ProfileNotFoundError(id);
      }

      // Check access permissions (only admin or profile owner)
      const canDelete =
        req.user.role === "admin" ||
        existingProfile.userId === requestingUserId;

      if (!canDelete) {
        throw new UserServiceError(
          "Access denied to delete this profile",
          "PROFILE_DELETE_DENIED",
          403,
        );
      }

      // Soft delete with audit logging in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Soft delete the profile
        const deletedProfile = await tx.userProfile.update({
          where: { id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            userProfileId: deletedProfile.id,
            clientId: deletedProfile.clientId,
            action: "DELETE_PROFILE",
            resource: "UserProfile",
            resourceId: deletedProfile.id,
            changes: {
              before: { isActive: true },
              after: { isActive: false },
            },
            metadata: {
              source: "user-service",
              deletedBy: requestingUserId,
              deletedByRole: req.user.role,
              deletionType: "soft_delete",
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            requestId: req.id,
          },
        });

        return deletedProfile;
      });

      logger.info("User profile deleted successfully", {
        profileId: id,
        deletedBy: requestingUserId,
        service: "user-service",
      });

      res.json(
        APIResponse.success(
          {
            message: "Profile deleted successfully",
            profileId: id,
            deletedAt: result.updatedAt,
          },
          {
            service: "user-service",
            action: "delete_profile",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to delete user profile", {
        error: error.message,
        profileId: req.params.id,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // List user profiles with pagination and filtering
  static async listProfiles(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        clientId,
        isActive,
        isVerified,
      } = req.query;

      const requestingUserId = req.user.userId;

      // Build where clause based on permissions and filters
      const where = {};

      // Access control
      if (req.user.role === "client") {
        // Clients can only see profiles from their own client
        where.clientId = req.user.clientId;
      } else if (req.user.role === "operations") {
        // Operations can see profiles from their client
        where.clientId = req.user.clientId;
      }
      // Admin and support can see all profiles

      // Apply filters
      if (
        clientId &&
        (req.user.role === "admin" || req.user.role === "support")
      ) {
        where.clientId = clientId;
      }

      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      if (isVerified !== undefined) {
        where.isVerified = isVerified === "true";
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { companyName: { contains: search, mode: "insensitive" } },
          { designation: { contains: search, mode: "insensitive" } },
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Get profiles with count
      const [profiles, total] = await Promise.all([
        prisma.userProfile.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy]: sortOrder },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
              },
            },
          },
        }),
        prisma.userProfile.count({ where }),
      ]);

      // Create audit log for list access
      await prisma.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "LIST_PROFILES",
          resource: "UserProfile",
          metadata: {
            source: "user-service",
            filters: { clientId, isActive, isVerified, search },
            pagination: { page, limit },
            resultCount: profiles.length,
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          requestId: req.id,
        },
      });

      const hasMore = skip + take < total;
      const totalPages = Math.ceil(total / take);

      res.json(
        APIResponse.paginated(
          {
            profiles: profiles.map((profile) => ({
              id: profile.id,
              userId: profile.userId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              companyName: profile.companyName,
              designation: profile.designation,
              isActive: profile.isActive,
              isVerified: profile.isVerified,
              profileComplete: profile.profileComplete,
              clientId: profile.clientId,
              client: profile.client,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
            })),
          },
          {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasMore,
            sortBy,
            sortOrder,
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to list user profiles", {
        error: error.message,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Admin verify user profile
  static async verifyProfile(req, res) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.userId;

      // Get existing profile
      const existingProfile = await prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existingProfile) {
        throw new ProfileNotFoundError(id);
      }

      // Update profile verification status with audit logging
      const result = await prisma.$transaction(async (tx) => {
        const updatedProfile = await tx.userProfile.update({
          where: { id },
          data: {
            isVerified: true,
            updatedAt: new Date(),
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                subscriptionTier: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            userProfileId: updatedProfile.id,
            clientId: updatedProfile.clientId,
            action: "VERIFY_PROFILE",
            resource: "UserProfile",
            resourceId: updatedProfile.id,
            changes: {
              before: { isVerified: false },
              after: { isVerified: true },
            },
            metadata: {
              source: "user-service",
              verifiedBy: requestingUserId,
              verifiedByRole: req.user.role,
              adminAction: true,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            requestId: req.id,
          },
        });

        return updatedProfile;
      });

      logger.info("User profile verified successfully", {
        profileId: id,
        verifiedBy: requestingUserId,
        service: "user-service",
      });

      res.json(
        APIResponse.success(
          {
            profile: {
              id: result.id,
              userId: result.userId,
              firstName: result.firstName,
              lastName: result.lastName,
              isVerified: result.isVerified,
              clientId: result.clientId,
              client: result.client,
              updatedAt: result.updatedAt,
            },
            message: "Profile verified successfully",
          },
          {
            service: "user-service",
            action: "verify_profile",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to verify user profile", {
        error: error.message,
        profileId: req.params.id,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Admin activate/deactivate user profile
  static async toggleProfileActivation(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const requestingUserId = req.user.userId;

      // Default to true if not specified
      const newActiveStatus = isActive !== false;

      // Get existing profile
      const existingProfile = await prisma.userProfile.findUnique({
        where: { id },
      });

      if (!existingProfile) {
        throw new ProfileNotFoundError(id);
      }

      // Update profile activation status with audit logging
      const result = await prisma.$transaction(async (tx) => {
        const updatedProfile = await tx.userProfile.update({
          where: { id },
          data: {
            isActive: newActiveStatus,
            updatedAt: new Date(),
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                subscriptionTier: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: requestingUserId,
            userProfileId: updatedProfile.id,
            clientId: updatedProfile.clientId,
            action: newActiveStatus ? "ACTIVATE_PROFILE" : "DEACTIVATE_PROFILE",
            resource: "UserProfile",
            resourceId: updatedProfile.id,
            changes: {
              before: { isActive: existingProfile.isActive },
              after: { isActive: newActiveStatus },
            },
            metadata: {
              source: "user-service",
              modifiedBy: requestingUserId,
              modifiedByRole: req.user.role,
              adminAction: true,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
            requestId: req.id,
          },
        });

        return updatedProfile;
      });

      logger.info("User profile activation status updated", {
        profileId: id,
        isActive: newActiveStatus,
        modifiedBy: requestingUserId,
        service: "user-service",
      });

      res.json(
        APIResponse.success(
          {
            profile: {
              id: result.id,
              userId: result.userId,
              firstName: result.firstName,
              lastName: result.lastName,
              isActive: result.isActive,
              clientId: result.clientId,
              client: result.client,
              updatedAt: result.updatedAt,
            },
            message: `Profile ${newActiveStatus ? "activated" : "deactivated"} successfully`,
          },
          {
            service: "user-service",
            action: "toggle_profile_activation",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to update profile activation status", {
        error: error.message,
        profileId: req.params.id,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get profile statistics
  static async getProfileStats(req, res) {
    try {
      const requestingUserId = req.user.userId;

      // Build where clause based on user permissions
      const where = {};
      if (req.user.role === "operations") {
        where.clientId = req.user.clientId;
      }

      const [
        totalProfiles,
        activeProfiles,
        verifiedProfiles,
        profilesWithClients,
        recentProfiles,
      ] = await Promise.all([
        prisma.userProfile.count({ where }),
        prisma.userProfile.count({ where: { ...where, isActive: true } }),
        prisma.userProfile.count({ where: { ...where, isVerified: true } }),
        prisma.userProfile.count({
          where: { ...where, clientId: { not: null } },
        }),
        prisma.userProfile.count({
          where: {
            ...where,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
      ]);

      // Create audit log for stats access
      await prisma.auditLog.create({
        data: {
          userId: requestingUserId,
          action: "VIEW_PROFILE_STATS",
          resource: "UserProfile",
          metadata: {
            source: "user-service",
            statsRequested: {
              total: totalProfiles,
              active: activeProfiles,
              verified: verifiedProfiles,
            },
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          requestId: req.id,
        },
      });

      res.json(
        APIResponse.success(
          {
            stats: {
              total: totalProfiles,
              active: activeProfiles,
              verified: verifiedProfiles,
              withClients: profilesWithClients,
              recent: recentProfiles,
              completionRate:
                totalProfiles > 0
                  ? (verifiedProfiles / totalProfiles) * 100
                  : 0,
              clientAssociationRate:
                totalProfiles > 0
                  ? (profilesWithClients / totalProfiles) * 100
                  : 0,
            },
          },
          {
            service: "user-service",
            action: "profile_stats",
          },
        ),
      );
    } catch (error) {
      logger.error("Failed to get profile statistics", {
        error: error.message,
        userId: req.user?.userId,
        service: "user-service",
      });
      throw error;
    }
  }
}

module.exports = UserController;
