// Bootstrap Controller - Internal endpoint for signup orchestration
// Creates UserProfile records for new signups
// Called by auth-service after creating the auth user

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Bootstrap a new user profile from signup
 * This internal endpoint creates:
 * 1. UserProfile linked to the auth user
 *
 * Called by auth-service after successful user creation
 * Requires X-Internal-Request header for security
 */
async function bootstrapUser(req, res) {
  try {
    const {
      userId,
      email,
      name,
      firstName,
      lastName,
      phone,
      // Optional client association (for future use)
      clientId = null,
    } = req.body;

    // Validate required fields
    if (!userId) {
      throw new UserServiceError(
        "User ID is required",
        "USER_ID_REQUIRED",
        400,
      );
    }

    if (!email) {
      throw new UserServiceError("Email is required", "EMAIL_REQUIRED", 400);
    }

    // Parse firstName/lastName from name if not provided separately
    let parsedFirstName = firstName;
    let parsedLastName = lastName;

    if (name && (!firstName || !lastName)) {
      const nameParts = name.trim().split(/\s+/);
      parsedFirstName = parsedFirstName || nameParts[0] || "";
      parsedLastName =
        parsedLastName || nameParts.slice(1).join(" ") || nameParts[0] || "";
    }

    // Check if user profile already exists
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new UserServiceError(
        "User profile already exists",
        "PROFILE_ALREADY_EXISTS",
        409,
      );
    }

    // Create UserProfile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create UserProfile
      const userProfile = await tx.userProfile.create({
        data: {
          userId,
          firstName: parsedFirstName || "",
          lastName: parsedLastName || "",
          phoneNumber: phone,
          clientId,
          isActive: true,
          isVerified: false,
          profileComplete: false,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          clientId,
          action: "BOOTSTRAP_USER_PROFILE",
          resource: "UserProfile",
          resourceId: userProfile.id,
          changes: {
            created: {
              userProfile: {
                id: userProfile.id,
                userId: userProfile.userId,
              },
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/internal/bootstrap-user",
            action: "signup",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return {
        userProfile,
      };
    });

    logger.info("User profile bootstrapped successfully", {
      userId,
      profileId: result.userProfile.id,
      email,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        userProfile: result.userProfile,
        message: "User profile bootstrapped successfully",
      }),
    );
  } catch (error) {
    logger.error("Bootstrap user profile error", {
      error: error.message,
      requestBody: { ...req.body, password: undefined },
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Delete bootstrapped user profile records
 * Called by auth-service if user creation needs to be rolled back
 * Requires X-Internal-Request header for security
 */
async function rollbackBootstrap(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new UserServiceError(
        "User ID is required",
        "USER_ID_REQUIRED",
        400,
      );
    }

    // Delete all related records in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get the user profile first
      const userProfile = await tx.userProfile.findUnique({
        where: { userId },
      });

      if (!userProfile) {
        // Nothing to rollback
        return { deleted: false, message: "No user profile found to rollback" };
      }

      // Delete UserProfile records
      await tx.userProfile.delete({
        where: { userId },
      });

      // Create audit log for rollback
      await tx.auditLog.create({
        data: {
          userId,
          action: "ROLLBACK_BOOTSTRAP",
          resource: "UserProfile",
          resourceId: userId,
          changes: {
            deleted: {
              userId,
              userProfileId: userProfile.id,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/internal/bootstrap-user/${userId}`,
            action: "rollback",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return {
        deleted: true,
        userProfileDeleted: 1,
      };
    });

    logger.warn("Bootstrap rollback executed", {
      userId,
      result,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        ...result,
        message: result.deleted
          ? "Bootstrap rollback completed successfully"
          : "No records found to rollback",
      }),
    );
  } catch (error) {
    logger.error("Rollback bootstrap error", {
      error: error.message,
      userId: req.params.userId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Check if a user has been bootstrapped
 * Used by auth-service to verify setup state
 */
async function checkBootstrapStatus(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new UserServiceError(
        "User ID is required",
        "USER_ID_REQUIRED",
        400,
      );
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const bootstrapped = !!userProfile;

    res.json(
      APIResponse.success({
        userId,
        bootstrapped,
        userProfile: userProfile
          ? {
              id: userProfile.id,
              firstName: userProfile.firstName,
              lastName: userProfile.lastName,
              profileComplete: userProfile.profileComplete,
            }
          : null,
      }),
    );
  } catch (error) {
    logger.error("Check bootstrap status error", {
      error: error.message,
      userId: req.params.userId,
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Get user context for authentication enrichment
 * Returns clientId for JWT token enrichment
 * Called by auth-service during login
 */
async function getUserContext(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      throw new UserServiceError(
        "User ID is required",
        "USER_ID_REQUIRED",
        400,
      );
    }

    // Find user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      // User exists in auth but not bootstrapped in user-service
      // Return null context - auth-service will handle this case
      return res.json(
        APIResponse.success({
          userId,
          clientId: null,
          found: false,
        }),
      );
    }

    logger.info("User context retrieved", {
      userId,
      clientId: userProfile.clientId,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        userId,
        clientId: userProfile.clientId,
        found: true,
      }),
    );
  } catch (error) {
    logger.error("Get user context error", {
      error: error.message,
      userId: req.params.userId,
      service: "user-service",
    });
    throw error;
  }
}

module.exports = {
  bootstrapUser,
  rollbackBootstrap,
  checkBootstrapStatus,
  getUserContext,
};
