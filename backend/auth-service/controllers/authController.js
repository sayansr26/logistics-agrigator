const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { prisma } = require("../config/database");
const { getRedisClient } = require("../config/redis");
const APIResponse = require("../shared/lib/response");
const {
  ConflictError,
  errorUtils,
} = require("../shared/lib/errors");

class AuthController {
  // User registration
  static async register(req, res) {
    try {
      const { email, password, role = "client", clientId } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user with Prisma
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          clientId,
        },
        select: {
          id: true,
          email: true,
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
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const successResponse = APIResponse.success({ user });
      res.status(201).json(successResponse);
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

      // Generate tokens
      const permissions = AuthController.getRolePermissions(user.role);
      const accessToken = jwt.sign(
        {
          userId: user.id,
          clientId: user.clientId,
          role: user.role,
          permissions,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "3600s" },
      );

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
        JSON.stringify({ userId: user.id, role: user.role }),
      );

      // Log successful login
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          resource: "session",
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
      console.error("Login error:", error);
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

      // Generate new access token
      const permissions = AuthController.getRolePermissions(user.role);
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          clientId: user.clientId,
          role: user.role,
          permissions,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "3600s" },
      );

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
        JSON.stringify({ userId: user.id, role: user.role }),
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

  // Get role permissions
  static getRolePermissions(role) {
    const permissions = {
      admin: ["all_permissions"],
      finance: ["wallet_access", "billing_access", "reports_access"],
      operations: ["shipment_access", "tracking_access", "partner_access"],
      client: ["own_shipments", "tracking", "wallet_view"],
      support: ["ticket_access", "user_support", "knowledge_base"],
    };

    return permissions[role] || [];
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
          metadata: {
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
          metadata: {
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
}

module.exports = AuthController;
