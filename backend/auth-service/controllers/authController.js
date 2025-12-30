const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { prisma } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const APIResponse = require("../shared/lib/response");
const { ConflictError, errorUtils } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

class AuthController {
  // User registration
  static async register(req, res) {
    try {
      const {
        email,
        password,
        name,
        firstName: providedFirstName,
        lastName: providedLastName,
        phone,
      } = req.body;

      // Parse firstName/lastName from name if not provided separately
      let firstName = providedFirstName;
      let lastName = providedLastName;

      if (name && (!firstName || !lastName)) {
        const nameParts = name.trim().split(/\s+/);
        firstName = firstName || nameParts[0] || "";
        lastName =
          lastName || nameParts.slice(1).join(" ") || nameParts[0] || "";
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Public signup creates client role by default
      const role = "client";

      // Create user with Prisma
      const user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          phone,
          passwordHash,
          role,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Log user creation
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          resource: "user",
          resourceId: user.id,
          changes: {
            email: user.email,
            role: user.role,
            registrationType: "public_signup",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Generate tokens - auto-login after successful registration
      const permissions = AuthController.getRolePermissions(user.role);
      const tokenPayload = {
        userId: user.id,
        clientId: user.clientId,
        role: user.role,
        permissions,
        // RBAC fields from auth-service (null for new users)
        accessLevel: null,
        assignedIds: [],
        parentClientId: null,
        parentUserId: null,
      };

      const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      });

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
      );

      // Store refresh token with Prisma
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Store session in Redis
      const redisClient = getRedisClient();
      await redisClient.setEx(
        `session:${user.id}`,
        3600,
        JSON.stringify({
          userId: user.id,
          role: user.role,
        }),
      );

      // Return same format as login - auto-login the user
      res.status(201).json({
        status: "success",
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            clientId: user.clientId,
            permissions,
          },
          accessToken,
          refreshToken,
          expiresIn: 3600,
        },
        meta: {
          message: "Registration successful",
          timestamp: new Date().toISOString(),
          service: "auth-service",
        },
      });
    } catch (error) {
      console.error("Registration error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Registration failed",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // User login
  static async login(req, res) {
    try {
      const { email, password, twoFactorCode } = req.body;

      // Get user with Prisma
      const user = await prisma.user.findUnique({
        where: {
          email,
          isActive: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password",
          },
        });
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(401).json({
            status: "error",
            error: {
              code: "TWO_FACTOR_REQUIRED",
              message: "2FA code required",
            },
          });
        }

        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: "base32",
          token: twoFactorCode,
          window: 1,
        });

        if (!verified) {
          return res.status(401).json({
            status: "error",
            error: {
              code: "INVALID_2FA_CODE",
              message: "Invalid 2FA code",
            },
          });
        }
      }

      // Generate tokens with enhanced claims
      const permissions = AuthController.getRolePermissions(user.role);
      const tokenPayload = {
        userId: user.id,
        clientId: user.clientId,
        role: user.role,
        permissions,
        // Include auth-service RBAC fields
        accessLevel: user.accessLevel || null,
        assignedIds: user.assignedIds || [],
        parentClientId: user.parentClientId || null,
        parentUserId: user.parentUserId || null,
      };

      const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      });

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
      );

      // Store refresh token with Prisma
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Store session in Redis
      const redisClient = getRedisClient();
      await redisClient.setEx(
        `session:${user.id}`,
        3600,
        JSON.stringify({
          userId: user.id,
          role: user.role,
        }),
      );

      // Log successful login
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          resource: "session",
          changes: {},
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            clientId: user.clientId,
            permissions,
          },
          accessToken,
          refreshToken,
          expiresIn: 3600,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Login failed",
        },
      });
    }
  }

  // Refresh token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "REFRESH_TOKEN_REQUIRED",
            message: "Refresh token is required",
          },
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      // Find session with Prisma
      const session = await prisma.session.findFirst({
        where: {
          userId: decoded.userId,
          refreshToken,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

      if (!session) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "INVALID_REFRESH_TOKEN",
            message: "Invalid or expired refresh token",
          },
        });
      }

      const user = session.user;

      // Generate new access token with enhanced claims
      const permissions = AuthController.getRolePermissions(user.role);
      const tokenPayload = {
        userId: user.id,
        clientId: user.clientId,
        role: user.role,
        permissions,
        // Include auth-service RBAC fields
        accessLevel: user.accessLevel || null,
        assignedIds: user.assignedIds || [],
        parentClientId: user.parentClientId || null,
        parentUserId: user.parentUserId || null,
      };

      const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      });

      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
      );

      // Update session with new refresh token
      await prisma.session.update({
        where: { id: session.id },
        data: {
          refreshToken: newRefreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Update session in Redis
      const redisClient = getRedisClient();
      await redisClient.setEx(
        `session:${user.id}`,
        3600,
        JSON.stringify({
          userId: user.id,
          role: user.role,
        }),
      );

      // Log token refresh
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "TOKEN_REFRESH",
          resource: "session",
          resourceId: session.id,
          changes: {
            sessionId: session.id,
            newTokenGenerated: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 3600,
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        status: "error",
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Invalid refresh token",
        },
      });
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const { refreshToken, accessToken } = req.body;
      const userId = req.user?.userId;

      // Get Redis client for blacklisting and session cleanup
      const redisClient = getRedisClient();

      if (refreshToken) {
        // Delete specific session
        await prisma.session.deleteMany({
          where: {
            refreshToken,
            userId,
          },
        });
      }

      // Blacklist the access token if provided
      if (accessToken) {
        try {
          const decoded = jwt.decode(accessToken);
          const expiresIn = decoded?.exp
            ? decoded.exp - Math.floor(Date.now() / 1000)
            : 3600;

          if (expiresIn > 0) {
            await redisClient.setEx(
              `blacklist:${accessToken}`,
              expiresIn,
              "true",
            );
          }
        } catch (tokenError) {
          console.warn("Failed to blacklist access token:", tokenError.message);
        }
      }

      if (userId) {
        // Remove from Redis
        await redisClient.del(`session:${userId}`);

        // Log logout with additional details
        await prisma.auditLog.create({
          data: {
            userId,
            action: "LOGOUT",
            resource: "session",
            changes: {
              sessionDeleted: !!refreshToken,
              tokenBlacklisted: !!accessToken,
              logoutType: refreshToken ? "explicit" : "session_only",
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });
      }

      res.json({
        status: "success",
        data: {
          message: "Logged out successfully",
          details: {
            sessionDeleted: !!refreshToken,
            tokenBlacklisted: !!accessToken,
          },
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Logout failed",
        },
      });
    }
  }

  // Logout from all devices
  static async logoutAllDevices(req, res) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
      }

      // Delete all sessions for the user
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          userId,
        },
      });

      // Remove from Redis
      const redisClient = getRedisClient();
      await redisClient.del(`session:${userId}`);

      // Log bulk logout
      await prisma.auditLog.create({
        data: {
          userId,
          action: "LOGOUT_ALL_DEVICES",
          resource: "session",
          changes: {
            deletedSessionsCount: deletedSessions.count,
            logoutType: "bulk",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          message: "Logged out from all devices successfully",
          deletedSessions: deletedSessions.count,
        },
      });
    } catch (error) {
      console.error("Logout all devices error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "INTERNAL_ERROR",
          message: "Logout from all devices failed",
        },
      });
    }
  }

  // Session cleanup - remove expired sessions
  static async cleanupExpiredSessions(req, res) {
    try {
      // Delete expired sessions from database
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      // Log cleanup activity
      await prisma.auditLog.create({
        data: {
          userId: null, // System operation
          action: "SESSION_CLEANUP",
          resource: "session",
          changes: {
            deletedCount: deletedSessions.count,
            cleanupTime: new Date().toISOString(),
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          message: "Session cleanup completed",
          deletedSessions: deletedSessions.count,
        },
      });
    } catch (error) {
      console.error("Session cleanup error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "CLEANUP_FAILED",
          message: "Session cleanup failed",
        },
      });
    }
  }

  // Blacklist token (for logout or security purposes)
  static async blacklistToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          status: "error",
          error: {
            code: "TOKEN_REQUIRED",
            message: "Token is required for blacklisting",
          },
        });
      }

      // Store blacklisted token in Redis with expiration
      const redisClient = getRedisClient();
      const decoded = jwt.decode(token);
      const expiresIn = decoded.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : 3600;

      if (expiresIn > 0) {
        await redisClient.setEx(`blacklist:${token}`, expiresIn, "true");
      }

      // Log token blacklisting
      await prisma.auditLog.create({
        data: {
          userId: decoded?.userId || null,
          action: "TOKEN_BLACKLISTED",
          resource: "token",
          changes: {
            tokenType: "access_token",
            reason: "manual_blacklist",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          message: "Token blacklisted successfully",
        },
      });
    } catch (error) {
      console.error("Token blacklist error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "BLACKLIST_FAILED",
          message: "Token blacklisting failed",
        },
      });
    }
  }

  // Get role permissions - uses shared constants for consistency
  static getRolePermissions(role) {
    const {
      getPermissionsForRole,
    } = require("../shared/constants/permissions");
    return getPermissionsForRole(role);
  }

  // Get current user basic info
  static async getCurrentUser(req, res) {
    try {
      // Create audit log for user info access
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "GET_USER_INFO",
          resource: "User",
          resourceId: req.user.userId,
          changes: {
            source: "auth-service",
            endpoint: "/auth/me",
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          user: {
            id: req.user.userId,
            role: req.user.role,
            clientId: req.user.clientId,
            permissions: req.user.permissions,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          service: "auth-service",
        },
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "USER_INFO_ERROR",
          message: "Failed to retrieve user information",
        },
        meta: {
          timestamp: new Date().toISOString(),
          service: "auth-service",
        },
      });
    }
  }

  // Get enhanced user profile with capabilities
  static async getUserProfile(req, res) {
    try {
      // Create audit log for profile access
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "GET_USER_PROFILE",
          resource: "User",
          resourceId: req.user.userId,
          changes: {
            source: "auth-service",
            endpoint: "/auth/profile",
            requestingRole: req.user.role,
            enrichedContext: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json({
        status: "success",
        data: {
          user: {
            id: req.user.userId,
            role: req.user.role,
            clientId: req.user.clientId,
            permissions: req.user.permissions,
            isAdmin: req.user.isAdmin,
            canAccessAll: req.user.canAccessAll,
            capabilities: req.user.capabilities,
            requestTimestamp: req.user.requestTimestamp,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          service: "auth-service",
        },
      });
    } catch (error) {
      console.error("Get user profile error:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "PROFILE_ERROR",
          message: "Failed to retrieve user profile",
        },
        meta: {
          timestamp: new Date().toISOString(),
          service: "auth-service",
        },
      });
    }
  }

  // Get user by ID
  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      // Get user without password_hash
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          twoFactorEnabled: true,
          parentClientId: true,
          parentUserId: true,
          accessLevel: true,
          licenseId: true,
          isLicenseActive: true,
          licenseValidUntil: true,
          commissionRate: true,
          commissionType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Log audit entry for user access
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "GET_USER_BY_ID",
          resource: "User",
          resourceId: id,
          changes: {
            accessedUserId: id,
            accessedUserEmail: user.email,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response
      const response = APIResponse.success(
        {
          user,
        },
        {
          service: "auth-service",
        },
      );

      res.json(response);
    } catch (error) {
      console.error("Get user by ID error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to retrieve user",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // Update user by ID
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Get existing user
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // If password is being updated, hash it
      if (updateData.password) {
        const bcrypt = require("bcryptjs");
        updateData.passwordHash = await bcrypt.hash(updateData.password, 12);
        delete updateData.password; // Remove plain password
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          twoFactorEnabled: true,
          parentClientId: true,
          parentUserId: true,
          accessLevel: true,
          licenseId: true,
          isLicenseActive: true,
          licenseValidUntil: true,
          commissionRate: true,
          commissionType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Log audit entry
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "UPDATE_USER",
          resource: "User",
          resourceId: id,
          changes: {
            updatedUserId: id,
            updatedFields: Object.keys(updateData),
            before: { email: existingUser.email, role: existingUser.role },
            after: { email: updatedUser.email, role: updatedUser.role },
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response
      const response = APIResponse.success(
        {
          user: updatedUser,
        },
        {
          service: "auth-service",
        },
      );

      res.json(response);
    } catch (error) {
      console.error("Update user error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to update user",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // Create user (admin only)
  static async createUser(req, res) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        clientId,
        parentClientId,
        parentUserId,
        licenseId,
        accessLevel,
        assignedIds,
        commissionRate,
        commissionType,
        isActive = true,
      } = req.body;

      // Validate required fields
      if (!email || !password || !role) {
        return res.status(400).json({
          status: "error",
          error: {
            code: "VALIDATION_ERROR",
            message: "Email, password, and role are required",
          },
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          status: "error",
          error: {
            code: "USER_EXISTS",
            message: "User with this email already exists",
          },
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Build user data
      const userData = {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role,
        isActive,
      };

      // Add optional fields if provided
      if (clientId) userData.clientId = clientId;
      if (parentClientId) userData.parentClientId = parentClientId;
      if (parentUserId) userData.parentUserId = parentUserId;
      if (licenseId) userData.licenseId = licenseId;
      if (accessLevel) userData.accessLevel = accessLevel;
      if (assignedIds) userData.assignedIds = assignedIds;
      if (commissionRate !== undefined)
        userData.commissionRate = commissionRate;
      if (commissionType) userData.commissionType = commissionType;

      // Create user
      const user = await prisma.user.create({
        data: userData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          twoFactorEnabled: true,
          parentClientId: true,
          parentUserId: true,
          accessLevel: true,
          licenseId: true,
          isLicenseActive: true,
          licenseValidUntil: true,
          commissionRate: true,
          commissionType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Log user creation
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "CREATE_USER",
          resource: "User",
          resourceId: user.id,
          changes: {
            createdUserId: user.id,
            createdUserEmail: user.email,
            createdUserRole: user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response
      const response = APIResponse.success(
        {
          user,
        },
        {
          service: "auth-service",
        },
      );

      res.status(201).json(response);
    } catch (error) {
      console.error("Create user error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to create user",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // List users with pagination, filtering, and search
  static async listUsers(req, res) {
    try {
      // Parse and validate pagination parameters
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      // Parse filter parameters
      const {
        role,
        isActive,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Build where clause
      const where = {};

      // Filter by role
      if (role) {
        where.role = role;
      }

      // Filter by active status
      if (isActive !== undefined) {
        where.isActive = isActive === "true" || isActive === true;
      }

      // Search by email or role (case-insensitive)
      if (search) {
        where.OR = [
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      // Get total count for pagination
      const total = await prisma.user.count({ where });

      // Get users without password_hash
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          twoFactorEnabled: true,
          parentClientId: true,
          parentUserId: true,
          accessLevel: true,
          licenseId: true,
          isLicenseActive: true,
          licenseValidUntil: true,
          commissionRate: true,
          commissionType: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          [sortBy]: sortOrder.toLowerCase() === "asc" ? "asc" : "desc",
        },
        skip,
        take: limit,
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      // Log audit entry for this admin action
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "LIST_USERS",
          resource: "User",
          changes: {
            filters: { role, isActive, search },
            pagination: { page, limit },
            resultCount: users.length,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response with pagination
      const response = APIResponse.success(
        {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
        {
          service: "auth-service",
        },
      );

      res.json(response);
    } catch (error) {
      console.error("List users error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to retrieve users",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // Deactivate user (admin only)
  static async deactivateUser(req, res) {
    try {
      const { id } = req.params;

      // Get existing user
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Check if user is already inactive
      if (!existingUser.isActive) {
        return res.status(400).json({
          status: "error",
          error: {
            code: "USER_ALREADY_INACTIVE",
            message: "User is already inactive",
          },
        });
      }

      // Deactivate user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          twoFactorEnabled: true,
          parentClientId: true,
          parentUserId: true,
          accessLevel: true,
          licenseId: true,
          isLicenseActive: true,
          licenseValidUntil: true,
          commissionRate: true,
          commissionType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Log audit entry
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "DEACTIVATE_USER",
          resource: "User",
          resourceId: id,
          changes: {
            userId: id,
            userEmail: existingUser.email,
            before: { isActive: true },
            after: { isActive: false },
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response
      const response = APIResponse.success(
        {
          user: updatedUser,
          message: "User deactivated successfully",
        },
        {
          service: "auth-service",
        },
      );

      res.json(response);
    } catch (error) {
      console.error("Deactivate user error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to deactivate user",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // Activate user (admin only)
  static async activateUser(req, res) {
    try {
      const { id } = req.params;

      // Get existing user
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Check if user is already active
      if (existingUser.isActive) {
        return res.status(400).json({
          status: "error",
          error: {
            code: "USER_ALREADY_ACTIVE",
            message: "User is already active",
          },
        });
      }

      // Activate user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          clientId: true,
          isActive: true,
          twoFactorEnabled: true,
          parentClientId: true,
          parentUserId: true,
          accessLevel: true,
          licenseId: true,
          isLicenseActive: true,
          licenseValidUntil: true,
          commissionRate: true,
          commissionType: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Log audit entry
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "ACTIVATE_USER",
          resource: "User",
          resourceId: id,
          changes: {
            userId: id,
            userEmail: existingUser.email,
            before: { isActive: false },
            after: { isActive: true },
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response
      const response = APIResponse.success(
        {
          user: updatedUser,
          message: "User activated successfully",
        },
        {
          service: "auth-service",
        },
      );

      res.json(response);
    } catch (error) {
      console.error("Activate user error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to activate user",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }

  // Delete user (admin only)
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Get existing user
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!existingUser) {
        return res.status(404).json({
          status: "error",
          error: {
            code: "USER_NOT_FOUND",
            message: "User not found",
          },
        });
      }

      // Prevent deletion of superadmin users
      if (existingUser.role === "superadmin") {
        return res.status(403).json({
          status: "error",
          error: {
            code: "CANNOT_DELETE_SUPERADMIN",
            message: "Superadmin users cannot be deleted",
          },
        });
      }

      // Delete user
      await prisma.user.delete({
        where: { id },
      });

      // Log audit entry
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "DELETE_USER",
          resource: "User",
          resourceId: id,
          changes: {
            deletedUserId: id,
            deletedUserEmail: existingUser.email,
            deletedUserRole: existingUser.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Return response
      const response = APIResponse.success(
        {
          message: "User deleted successfully",
        },
        {
          service: "auth-service",
        },
      );

      res.json(response);
    } catch (error) {
      console.error("Delete user error:", error);

      // Handle Prisma errors
      if (error.code && error.code.startsWith("P")) {
        const prismaError = errorUtils.handlePrismaError(error);
        const errorResponse = errorUtils.formatErrorResponse(prismaError);
        return res.status(prismaError.statusCode).json(errorResponse);
      }

      // Handle custom API errors
      if (errorUtils.isOperationalError(error)) {
        const errorResponse = errorUtils.formatErrorResponse(error);
        return res.status(error.statusCode).json(errorResponse);
      }

      // Handle unexpected errors
      const errorResponse = APIResponse.error(
        "Failed to delete user",
        "INTERNAL_ERROR",
      );
      res.status(500).json(errorResponse);
    }
  }
}

module.exports = AuthController;
