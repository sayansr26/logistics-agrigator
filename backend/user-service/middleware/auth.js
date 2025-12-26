// User Service Authentication Middleware
// Uses shared authentication utilities from auth-service (singleton pattern)
// NO authentication logic here - only JWT validation and user context

const { authMiddleware } = require("../shared/lib/auth");
const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");

const prisma = new PrismaClient();

// Enhanced authentication middleware with user profile context
const userServiceAuth = {
  // Basic JWT authentication using shared middleware
  authenticate: authMiddleware.authenticate,

  // Permission-based authorization using shared middleware
  authorize: authMiddleware.authorize,

  // Enhanced authentication that includes user profile data
  authenticateWithProfile: async (req, res, next) => {
    try {
      // First validate JWT token using shared middleware
      await new Promise((resolve, reject) => {
        authMiddleware.authenticate(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // If JWT is valid, enrich with user profile data
      if (req.user && req.user.userId) {
        try {
          const userProfile = await prisma.userProfile.findUnique({
            where: { userId: req.user.userId },
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

          // Add profile data to request context
          req.userProfile = userProfile;
          req.user.hasProfile = !!userProfile;
          req.user.clientId = userProfile?.clientId || null;
          req.user.client = userProfile?.client || null;
        } catch (profileError) {
          // Log error but don't fail authentication
          console.warn("Failed to fetch user profile:", profileError.message);
          req.userProfile = null;
          req.user.hasProfile = false;
        }
      }

      next();
    } catch (error) {
      return res
        .status(401)
        .json(
          APIResponse.error(
            "Authentication failed",
            "AUTHENTICATION_FAILED",
            error.message,
            401,
          ),
        );
    }
  },

  // Role-based access control using shared middleware
  requireRole: authMiddleware.requireRole,

  // Client-specific access control for multi-tenancy
  requireClientAccess: (allowedRoles = ["admin"]) => {
    return async (req, res, next) => {
      try {
        // First check if user is authenticated
        if (!req.user) {
          return res
            .status(401)
            .json(
              APIResponse.error(
                "Authentication required",
                "UNAUTHORIZED",
                null,
                401,
              ),
            );
        }

        // Admin always has access
        if (req.user.role === "admin") {
          return next();
        }

        // Check if user has required role
        if (!allowedRoles.includes(req.user.role)) {
          return res
            .status(403)
            .json(
              APIResponse.error(
                `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
                "FORBIDDEN",
                { userRole: req.user.role, requiredRoles: allowedRoles },
                403,
              ),
            );
        }

        // For non-admin users, ensure they have a client association
        if (!req.user.clientId && req.user.role !== "support") {
          return res
            .status(403)
            .json(
              APIResponse.error(
                "Client association required",
                "NO_CLIENT_ACCESS",
                null,
                403,
              ),
            );
        }

        next();
      } catch (error) {
        return res
          .status(500)
          .json(
            APIResponse.error(
              "Authorization check failed",
              "AUTHORIZATION_ERROR",
              error.message,
              500,
            ),
          );
      }
    };
  },

  // Ensure user can only access their own client's data
  requireOwnClientOrAdmin: async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json(
            APIResponse.error(
              "Authentication required",
              "UNAUTHORIZED",
              null,
              401,
            ),
          );
      }

      // Admin can access all clients
      if (req.user.role === "admin") {
        return next();
      }

      // Support can access all clients for support purposes
      if (req.user.role === "support") {
        return next();
      }

      // Extract client ID from request (params, body, or query)
      const requestedClientId =
        req.params.clientId || req.body.clientId || req.query.clientId;

      // If no specific client requested, user can access their own client
      if (!requestedClientId) {
        return next();
      }

      // Check if user is trying to access their own client
      if (req.user.clientId !== requestedClientId) {
        return res.status(403).json(
          APIResponse.error(
            "Access denied. Can only access own client data",
            "CLIENT_ACCESS_DENIED",
            {
              userClientId: req.user.clientId,
              requestedClientId,
            },
            403,
          ),
        );
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json(
          APIResponse.error(
            "Client access check failed",
            "CLIENT_ACCESS_ERROR",
            error.message,
            500,
          ),
        );
    }
  },

  // Ensure user profile exists
  requireProfile: async (req, res, next) => {
    try {
      if (!req.userProfile) {
        return res
          .status(400)
          .json(
            APIResponse.error(
              "User profile required. Please complete your profile setup.",
              "PROFILE_REQUIRED",
              null,
              400,
            ),
          );
      }

      if (!req.userProfile.isActive) {
        return res
          .status(403)
          .json(
            APIResponse.error(
              "User profile is inactive",
              "PROFILE_INACTIVE",
              null,
              403,
            ),
          );
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json(
          APIResponse.error(
            "Profile check failed",
            "PROFILE_CHECK_ERROR",
            error.message,
            500,
          ),
        );
    }
  },

  // Shorthand middleware combinations
  adminOnly: authMiddleware.adminOnly,
  clientOrHigher: authMiddleware.clientOrHigher,
  operationsOrHigher: authMiddleware.operationsOrHigher,
  financeOrAdmin: authMiddleware.financeOrAdmin,

  // User service specific combinations (defined after the object is created)
  // These will be added after the object is fully initialized
};

// Add middleware combinations after object is fully initialized
userServiceAuth.authenticatedWithProfile = [
  userServiceAuth.authenticateWithProfile,
  userServiceAuth.requireProfile,
];

userServiceAuth.clientAdmin = [
  authMiddleware.authenticate,
  userServiceAuth.requireClientAccess(["admin", "operations"]),
];

userServiceAuth.ownClientOnly = [
  userServiceAuth.authenticateWithProfile,
  userServiceAuth.requireOwnClientOrAdmin,
];

module.exports = userServiceAuth;
