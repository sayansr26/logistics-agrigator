// Bootstrap Controller - Internal endpoint for signup orchestration
// Creates Customer (DIRECT), UserProfile, and CustomerUser records for new signups
// Called by auth-service after creating the auth user

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { UserServiceError } = require("../middleware/errorHandler");

const prisma = new PrismaClient();

/**
 * Bootstrap a new direct customer from signup
 * This internal endpoint creates:
 * 1. Customer (customerType=DIRECT, id = userId from auth-service)
 * 2. UserProfile linked to the customer
 * 3. CustomerUser linking customer and user with role=customer
 *
 * Called by auth-service after successful user creation
 * Requires X-Internal-Request header for security
 */
async function bootstrapDirectCustomer(req, res) {
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

    const customerName = name || `${parsedFirstName} ${parsedLastName}`.trim();

    // Check if customer/user already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: userId },
    });

    if (existingCustomer) {
      throw new UserServiceError(
        "Customer already exists for this user",
        "CUSTOMER_ALREADY_EXISTS",
        409,
      );
    }

    // Check for email uniqueness (for direct customers without clientId)
    const existingEmail = await prisma.customer.findFirst({
      where: {
        email,
        clientId: null,
      },
    });

    if (existingEmail) {
      throw new UserServiceError(
        `Direct customer with email '${email}' already exists`,
        "CUSTOMER_EMAIL_EXISTS",
        409,
      );
    }

    // Create all records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Customer with DIRECT type and same ID as auth user
      const customer = await tx.customer.create({
        data: {
          id: userId, // Use same ID as auth-service user for easy correlation
          clientId,
          customerType: "DIRECT",
          name: customerName,
          email,
          phone,
          enabledModules: ["shipment", "billing", "wallet", "analytics"],
          isActive: true,
        },
      });

      // 2. Create UserProfile
      const userProfile = await tx.userProfile.create({
        data: {
          userId,
          firstName: parsedFirstName || "",
          lastName: parsedLastName || "",
          phoneNumber: phone,
          customerId: customer.id,
          customerRole: "customer",
          clientId,
          isActive: true,
          isVerified: false,
          profileComplete: false,
        },
      });

      // 3. Create CustomerUser link
      const customerUser = await tx.customerUser.create({
        data: {
          customerId: customer.id,
          userId,
          role: "customer",
          enabledModules: ["shipment", "billing", "wallet", "analytics"],
          isActive: true,
        },
      });

      // 4. Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          clientId,
          action: "BOOTSTRAP_DIRECT_CUSTOMER",
          resource: "Customer",
          resourceId: customer.id,
          changes: {
            created: {
              customer: {
                id: customer.id,
                email: customer.email,
                customerType: "DIRECT",
              },
              userProfile: {
                id: userProfile.id,
                userId: userProfile.userId,
              },
              customerUser: {
                id: customerUser.id,
                role: customerUser.role,
              },
            },
          },
          metadata: {
            source: "user-service",
            endpoint: "/api/v1/internal/bootstrap-customer",
            action: "signup",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return {
        customer,
        userProfile,
        customerUser,
      };
    });

    logger.info("Direct customer bootstrapped successfully", {
      userId,
      customerId: result.customer.id,
      email,
      service: "user-service",
    });

    res.status(201).json(
      APIResponse.success({
        customer: result.customer,
        userProfile: result.userProfile,
        customerUser: result.customerUser,
        message: "Direct customer bootstrapped successfully",
      }),
    );
  } catch (error) {
    logger.error("Bootstrap direct customer error", {
      error: error.message,
      requestBody: { ...req.body, password: undefined },
      service: "user-service",
    });
    throw error;
  }
}

/**
 * Delete bootstrapped customer records
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
      // Get the customer first
      const customer = await tx.customer.findUnique({
        where: { id: userId },
      });

      if (!customer) {
        // Nothing to rollback
        return { deleted: false, message: "No customer found to rollback" };
      }

      // Delete CustomerUser records
      const deletedCustomerUsers = await tx.customerUser.deleteMany({
        where: { customerId: userId },
      });

      // Delete UserProfile records
      const deletedUserProfiles = await tx.userProfile.deleteMany({
        where: { userId },
      });

      // Delete Customer
      await tx.customer.delete({
        where: { id: userId },
      });

      // Create audit log for rollback
      await tx.auditLog.create({
        data: {
          userId,
          action: "ROLLBACK_BOOTSTRAP",
          resource: "Customer",
          resourceId: userId,
          changes: {
            deleted: {
              customerId: userId,
              customerUsersDeleted: deletedCustomerUsers.count,
              userProfilesDeleted: deletedUserProfiles.count,
            },
          },
          metadata: {
            source: "user-service",
            endpoint: `/api/v1/internal/bootstrap-customer/${userId}`,
            action: "rollback",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return {
        deleted: true,
        customerUsersDeleted: deletedCustomerUsers.count,
        userProfilesDeleted: deletedUserProfiles.count,
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

    const customer = await prisma.customer.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            userProfiles: true,
            customerUsers: true,
          },
        },
      },
    });

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const bootstrapped = !!(customer && userProfile);

    res.json(
      APIResponse.success({
        userId,
        bootstrapped,
        customer: customer
          ? {
              id: customer.id,
              customerType: customer.customerType,
              email: customer.email,
              isActive: customer.isActive,
            }
          : null,
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
 * Returns outletId, outletRole, customerId, customerRole, clientId for JWT token enrichment
 * Called by auth-service during login to include outlet/customer scoping in token
 * 
 * User types:
 * - Outlet users: have outletId + outletRole (outlet_admin/outlet_staff)
 * - B2C customers: have customerId + customerRole (no outlet)
 * - B2B customers: would have customerId + outletId (customer belongs to outlet)
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

    // Find user profile with outlet and customer associations
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            isActive: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerType: true,
            name: true,
            email: true,
            clientId: true,
            isActive: true,
            outletId: true,
          },
        },
      },
    });

    if (!userProfile) {
      // User exists in auth but not bootstrapped in user-service
      // Return null context - auth-service will handle this case
      return res.json(
        APIResponse.success({
          userId,
          outletId: null,
          outletRole: null,
          customerId: null,
          customerRole: null,
          customerType: null,
          clientId: null,
          found: false,
        }),
      );
    }

    // Check for outlet user association (new Outlet model)
    let outletId = userProfile.outletId || null;
    let outletRole = userProfile.outletRole || null;

    // If not directly on profile, check OutletUser table
    if (!outletId) {
      const outletUser = await prisma.outletUser.findFirst({
        where: {
          userId,
          isActive: true,
        },
        include: {
          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              isActive: true,
            },
          },
        },
      });

      if (outletUser) {
        outletId = outletUser.outletId;
        outletRole = outletUser.role;
      }
    }

    // Check CustomerUser for customer associations (B2C/B2B customers)
    const customerUser = await prisma.customerUser.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerType: true,
            name: true,
            clientId: true,
            isActive: true,
            outletId: true,
          },
        },
      },
    });

    // Get customer context
    const customerId = userProfile.customerId || customerUser?.customerId || null;
    const customerRole = userProfile.customerRole || customerUser?.role || null;
    const clientId = userProfile.clientId || customerUser?.customer?.clientId || null;
    const customerType = userProfile.customer?.customerType || customerUser?.customer?.customerType || null;

    // If customer is B2B and has an outletId, include that too
    const customerOutletId = userProfile.customer?.outletId || customerUser?.customer?.outletId || null;

    logger.info("User context retrieved", {
      userId,
      outletId,
      outletRole,
      customerId,
      customerRole,
      clientId,
      customerType,
      customerOutletId,
      service: "user-service",
    });

    res.json(
      APIResponse.success({
        userId,
        // Outlet context (for outlet users)
        outletId,
        outletRole,
        outlet: userProfile.outlet || null,
        // Customer context (for B2C/B2B customers)
        customerId,
        customerRole,
        customerType,
        clientId,
        customer: userProfile.customer || customerUser?.customer || null,
        // For B2B customers, their outlet affiliation
        customerOutletId,
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
  bootstrapDirectCustomer,
  rollbackBootstrap,
  checkBootstrapStatus,
  getUserContext,
};
