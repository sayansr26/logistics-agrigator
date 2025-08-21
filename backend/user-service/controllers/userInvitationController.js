// User Invitation Controller - Client user invitation management
// Handles user invitation CRUD operations for multi-tenant client user management

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const {
  ClientNotFoundError,
  UserServiceError,
  UserInvitationError,
} = require("../middleware/errorHandler");

const prisma = new PrismaClient();

class UserInvitationController {
  // Create a new user invitation
  static async createInvitation(req, res) {
    try {
      const { clientId, email, role = "client", expiresAt } = req.body;

      // Verify client exists
      const client = await prisma.client.findUnique({
        where: { id: clientId, isActive: true },
      });

      if (!client) {
        throw new ClientNotFoundError(clientId);
      }

      // Role-based access control
      if (req.user.role !== "admin" && req.user.clientId !== clientId) {
        throw new UserServiceError(
          "Access denied. You can only create invitations for your own client.",
          "INVITATION_ACCESS_DENIED",
          403,
        );
      }

      // Only admin and operations can invite users
      if (req.user.role !== "admin" && req.user.role !== "operations") {
        throw new UserServiceError(
          "Access denied. Only administrators and operations staff can send invitations.",
          "INVITATION_PERMISSION_DENIED",
          403,
        );
      }

      // Check if user is already invited or exists
      const [existingInvitation] = await Promise.all([
        prisma.userInvitation.findFirst({
          where: {
            email,
            clientId,
            status: { in: ["pending", "accepted"] },
          },
        }),
        prisma.userProfile.findFirst({
          where: {
            clientId,
            // Note: We can't directly check email since it's in auth-service
            // This would require a call to auth-service or storing email in profile
          },
        }),
      ]);

      if (existingInvitation) {
        throw new UserInvitationError(
          `User with email ${email} already has a ${existingInvitation.status} invitation for this client`,
          "INVITATION_EXISTS",
          409,
        );
      }

      // Generate secure invitation token
      const token = crypto.randomBytes(32).toString("hex");

      // Set default expiration (7 days from now)
      const defaultExpiresAt = new Date();
      defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);

      // Create invitation with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const invitation = await tx.userInvitation.create({
          data: {
            clientId,
            email: email.toLowerCase(),
            role,
            invitedBy: req.user.userId,
            token,
            expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiresAt,
            status: "pending",
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId,
            action: "CREATE_USER_INVITATION",
            resource: "UserInvitation",
            resourceId: invitation.id,
            changes: {
              created: {
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
                token: "***REDACTED***", // Don't log the actual token
              },
            },
            metadata: {
              source: "user-service",
              endpoint: "/api/invitations",
              invitedBy: req.user.role,
              clientName: client.name,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return invitation;
      });

      logger.info("User invitation created successfully", {
        invitationId: result.id,
        email: result.email,
        clientId,
        role: result.role,
        invitedBy: req.user.userId,
        service: "user-service",
      });

      // Don't return the token in the response for security
      const { token: _, ...invitationResponse } = result;

      res.status(201).json(
        APIResponse.success(
          {
            invitation: {
              ...invitationResponse,
              invitationUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/accept-invitation?token=${token}`,
            },
            message: "User invitation created successfully",
          },
          201,
        ),
      );
    } catch (error) {
      logger.error("Create invitation error", {
        error: error.message,
        userId: req.user.userId,
        requestBody: { ...req.body, token: undefined }, // Don't log sensitive data
        service: "user-service",
      });
      throw error;
    }
  }

  // List invitations with pagination and filtering
  static async listInvitations(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        status,
        role,
        clientId,
        startDate,
        endDate,
      } = req.query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {};

      if (search) {
        where.email = { contains: search, mode: "insensitive" };
      }

      if (status) {
        where.status = status;
      }

      if (role) {
        where.role = role;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Role-based filtering
      if (req.user.role !== "admin" && req.user.role !== "support") {
        // Non-admin users can only see invitations for their own client
        where.clientId = req.user.clientId;
      } else if (clientId) {
        // Admin/support can filter by specific client
        where.clientId = clientId;
      }

      const [invitations, total] = await Promise.all([
        prisma.userInvitation.findMany({
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
          },
        }),
        prisma.userInvitation.count({ where }),
      ]);

      // Create audit log for list access
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "LIST_USER_INVITATIONS",
          resource: "UserInvitation",
          metadata: {
            source: "user-service",
            endpoint: "/api/invitations",
            filters: { search, status, role, clientId },
            pagination: { page, limit },
            resultCount: invitations.length,
            totalCount: total,
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const hasMore = skip + invitations.length < total;
      const totalPages = Math.ceil(total / limit);

      // Remove tokens from response for security
      const sanitizedInvitations = invitations.map(
        ({ token, ...invitation }) => invitation,
      );

      res.json(
        APIResponse.success({
          invitations: sanitizedInvitations,
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
            status,
            role,
            clientId,
            startDate,
            endDate,
          },
        }),
      );
    } catch (error) {
      logger.error("List invitations error", {
        error: error.message,
        userId: req.user.userId,
        query: req.query,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get a specific invitation by ID
  static async getInvitation(req, res) {
    try {
      const { id } = req.params;

      const invitation = await prisma.userInvitation.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
              domain: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new UserInvitationError(
          `Invitation with ID ${id} not found`,
          "INVITATION_NOT_FOUND",
          404,
        );
      }

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.role !== "support" &&
        req.user.clientId !== invitation.clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only view invitations for your own client.",
          "INVITATION_ACCESS_DENIED",
          403,
        );
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          clientId: invitation.clientId,
          action: "GET_USER_INVITATION",
          resource: "UserInvitation",
          resourceId: invitation.id,
          metadata: {
            source: "user-service",
            endpoint: `/api/invitations/${id}`,
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Remove token from response for security
      const { token, ...invitationResponse } = invitation;

      res.json(APIResponse.success({ invitation: invitationResponse }));
    } catch (error) {
      logger.error("Get invitation error", {
        error: error.message,
        invitationId: req.params.id,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Update invitation status or details
  static async updateInvitation(req, res) {
    try {
      const { id } = req.params;
      const { status, role, expiresAt } = req.body;

      const invitation = await prisma.userInvitation.findUnique({
        where: { id },
      });

      if (!invitation) {
        throw new UserInvitationError(
          `Invitation with ID ${id} not found`,
          "INVITATION_NOT_FOUND",
          404,
        );
      }

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.clientId !== invitation.clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only update invitations for your own client.",
          "INVITATION_UPDATE_DENIED",
          403,
        );
      }

      // Only admin and operations can update invitations
      if (req.user.role !== "admin" && req.user.role !== "operations") {
        throw new UserServiceError(
          "Access denied. Only administrators and operations staff can update invitations.",
          "INVITATION_PERMISSION_DENIED",
          403,
        );
      }

      // Validate status transitions
      if (status && invitation.status === "accepted") {
        throw new UserInvitationError(
          "Cannot modify accepted invitations",
          "INVITATION_ALREADY_ACCEPTED",
          400,
        );
      }

      if (status && invitation.status === "expired") {
        throw new UserInvitationError(
          "Cannot modify expired invitations",
          "INVITATION_EXPIRED",
          400,
        );
      }

      // Build update data
      const updateData = {};
      if (status) updateData.status = status;
      if (role) updateData.role = role;
      if (expiresAt) updateData.expiresAt = new Date(expiresAt);

      // Update invitation with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const updatedInvitation = await tx.userInvitation.update({
          where: { id },
          data: updateData,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        // Create audit log with before/after changes
        const changes = {};
        Object.keys(updateData).forEach((key) => {
          if (invitation[key] !== updateData[key]) {
            changes[key] = {
              before: invitation[key],
              after: updateData[key],
            };
          }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: invitation.clientId,
            action: "UPDATE_USER_INVITATION",
            resource: "UserInvitation",
            resourceId: updatedInvitation.id,
            changes,
            metadata: {
              source: "user-service",
              endpoint: `/api/invitations/${id}`,
              updatedBy: req.user.role,
              fieldsUpdated: Object.keys(updateData),
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updatedInvitation;
      });

      logger.info("Invitation updated successfully", {
        invitationId: id,
        updatedFields: Object.keys(updateData),
        updatedBy: req.user.userId,
        service: "user-service",
      });

      // Remove token from response for security
      const { token, ...invitationResponse } = result;

      res.json(
        APIResponse.success({
          invitation: invitationResponse,
          message: "Invitation updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update invitation error", {
        error: error.message,
        invitationId: req.params.id,
        userId: req.user.userId,
        updateData: req.body,
        service: "user-service",
      });
      throw error;
    }
  }

  // Cancel an invitation
  static async cancelInvitation(req, res) {
    try {
      const { id } = req.params;

      const invitation = await prisma.userInvitation.findUnique({
        where: { id },
      });

      if (!invitation) {
        throw new UserInvitationError(
          `Invitation with ID ${id} not found`,
          "INVITATION_NOT_FOUND",
          404,
        );
      }

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.clientId !== invitation.clientId &&
        req.user.userId !== invitation.invitedBy
      ) {
        throw new UserServiceError(
          "Access denied. You can only cancel invitations for your own client or invitations you sent.",
          "INVITATION_CANCEL_DENIED",
          403,
        );
      }

      // Check if invitation can be cancelled
      if (invitation.status === "accepted") {
        throw new UserInvitationError(
          "Cannot cancel accepted invitations",
          "INVITATION_ALREADY_ACCEPTED",
          400,
        );
      }

      if (invitation.status === "cancelled") {
        return res.json(
          APIResponse.success({
            message: "Invitation is already cancelled",
            invitation: {
              id: invitation.id,
              email: invitation.email,
              status: invitation.status,
            },
          }),
        );
      }

      // Cancel invitation with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const cancelledInvitation = await tx.userInvitation.update({
          where: { id },
          data: { status: "cancelled" },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: invitation.clientId,
            action: "CANCEL_USER_INVITATION",
            resource: "UserInvitation",
            resourceId: cancelledInvitation.id,
            changes: {
              status: {
                before: invitation.status,
                after: "cancelled",
              },
            },
            metadata: {
              source: "user-service",
              endpoint: `/api/invitations/${id}/cancel`,
              cancelledBy: req.user.role,
              originalInviter: invitation.invitedBy,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return cancelledInvitation;
      });

      logger.info("Invitation cancelled", {
        invitationId: id,
        email: invitation.email,
        cancelledBy: req.user.userId,
        service: "user-service",
      });

      // Remove token from response for security
      const { token, ...invitationResponse } = result;

      res.json(
        APIResponse.success({
          invitation: invitationResponse,
          message: "Invitation cancelled successfully",
        }),
      );
    } catch (error) {
      logger.error("Cancel invitation error", {
        error: error.message,
        invitationId: req.params.id,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Resend an invitation (generate new token and extend expiry)
  static async resendInvitation(req, res) {
    try {
      const { id } = req.params;

      const invitation = await prisma.userInvitation.findUnique({
        where: { id },
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

      if (!invitation) {
        throw new UserInvitationError(
          `Invitation with ID ${id} not found`,
          "INVITATION_NOT_FOUND",
          404,
        );
      }

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.clientId !== invitation.clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only resend invitations for your own client.",
          "INVITATION_RESEND_DENIED",
          403,
        );
      }

      // Only admin and operations can resend invitations
      if (req.user.role !== "admin" && req.user.role !== "operations") {
        throw new UserServiceError(
          "Access denied. Only administrators and operations staff can resend invitations.",
          "INVITATION_PERMISSION_DENIED",
          403,
        );
      }

      // Check if invitation can be resent
      if (invitation.status === "accepted") {
        throw new UserInvitationError(
          "Cannot resend accepted invitations",
          "INVITATION_ALREADY_ACCEPTED",
          400,
        );
      }

      if (!invitation.client.isActive) {
        throw new UserInvitationError(
          "Cannot resend invitations for inactive clients",
          "CLIENT_INACTIVE",
          400,
        );
      }

      // Generate new token and extend expiry
      const newToken = crypto.randomBytes(32).toString("hex");
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

      // Update invitation with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const updatedInvitation = await tx.userInvitation.update({
          where: { id },
          data: {
            token: newToken,
            expiresAt: newExpiresAt,
            status: "pending", // Reset to pending if it was expired/cancelled
          },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId: invitation.clientId,
            action: "RESEND_USER_INVITATION",
            resource: "UserInvitation",
            resourceId: updatedInvitation.id,
            changes: {
              token: "***REGENERATED***",
              expiresAt: {
                before: invitation.expiresAt,
                after: newExpiresAt,
              },
              status: {
                before: invitation.status,
                after: "pending",
              },
            },
            metadata: {
              source: "user-service",
              endpoint: `/api/invitations/${id}/resend`,
              resentBy: req.user.role,
              originalInviter: invitation.invitedBy,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updatedInvitation;
      });

      logger.info("Invitation resent successfully", {
        invitationId: id,
        email: invitation.email,
        resentBy: req.user.userId,
        newExpiresAt,
        service: "user-service",
      });

      // Remove token from response for security, but include invitation URL
      const { token, ...invitationResponse } = result;

      res.json(
        APIResponse.success({
          invitation: {
            ...invitationResponse,
            invitationUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/accept-invitation?token=${newToken}`,
          },
          message: "Invitation resent successfully",
        }),
      );
    } catch (error) {
      logger.error("Resend invitation error", {
        error: error.message,
        invitationId: req.params.id,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Validate invitation token (public endpoint for accepting invitations)
  static async validateInvitationToken(req, res) {
    try {
      const { token } = req.params;

      const invitation = await prisma.userInvitation.findUnique({
        where: { token },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
              domain: true,
              isActive: true,
              clientSettings: {
                select: {
                  brandName: true,
                  logo: true,
                  primaryColor: true,
                },
              },
            },
          },
        },
      });

      if (!invitation) {
        throw new UserInvitationError(
          "Invalid invitation token",
          "INVALID_INVITATION_TOKEN",
          404,
        );
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        // Update status to expired
        await prisma.userInvitation.update({
          where: { id: invitation.id },
          data: { status: "expired" },
        });

        throw new UserInvitationError(
          "Invitation has expired",
          "INVITATION_EXPIRED",
          410,
        );
      }

      // Check if invitation is still pending
      if (invitation.status !== "pending") {
        throw new UserInvitationError(
          `Invitation is ${invitation.status}`,
          `INVITATION_${invitation.status.toUpperCase()}`,
          400,
        );
      }

      // Check if client is still active
      if (!invitation.client.isActive) {
        throw new UserInvitationError(
          "Client is no longer active",
          "CLIENT_INACTIVE",
          400,
        );
      }

      // Create audit log (no user context for public endpoint)
      await prisma.auditLog.create({
        data: {
          clientId: invitation.clientId,
          action: "VALIDATE_INVITATION_TOKEN",
          resource: "UserInvitation",
          resourceId: invitation.id,
          metadata: {
            source: "user-service",
            endpoint: `/api/public/invitations/validate/${token}`,
            publicAccess: true,
            email: invitation.email,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      // Remove sensitive data from response
      const { token: _, invitedBy, ...invitationResponse } = invitation;

      res.json(
        APIResponse.success({
          invitation: invitationResponse,
          valid: true,
          message: "Invitation is valid and ready to be accepted",
        }),
      );
    } catch (error) {
      logger.error("Validate invitation token error", {
        error: error.message,
        token: req.params.token ? "***PROVIDED***" : "***MISSING***",
        service: "user-service",
      });
      throw error;
    }
  }

  // Get invitation statistics
  static async getInvitationStats(req, res) {
    try {
      // Role-based access control
      if (req.user.role !== "admin" && req.user.role !== "support") {
        throw new UserServiceError(
          "Access denied. Only administrators and support can view invitation statistics.",
          "INVITATION_STATS_DENIED",
          403,
        );
      }

      const stats = await prisma.$transaction(async (tx) => {
        const baseWhere =
          req.user.role === "admin" ? {} : { clientId: req.user.clientId };

        const [
          totalInvitations,
          invitationsByStatus,
          invitationsByRole,
          recentInvitations,
          expiringInvitations,
        ] = await Promise.all([
          tx.userInvitation.count({ where: baseWhere }),
          tx.userInvitation.groupBy({
            by: ["status"],
            _count: { id: true },
            where: baseWhere,
          }),
          tx.userInvitation.groupBy({
            by: ["role"],
            _count: { id: true },
            where: baseWhere,
          }),
          tx.userInvitation.findMany({
            where: baseWhere,
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              createdAt: true,
              client: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          }),
          tx.userInvitation.findMany({
            where: {
              ...baseWhere,
              status: "pending",
              expiresAt: {
                lte: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
              },
            },
            select: {
              id: true,
              email: true,
              expiresAt: true,
              client: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
            orderBy: { expiresAt: "asc" },
          }),
        ]);

        return {
          overview: {
            totalInvitations,
          },
          byStatus: invitationsByStatus.reduce((acc, status) => {
            acc[status.status] = status._count.id;
            return acc;
          }, {}),
          byRole: invitationsByRole.reduce((acc, role) => {
            acc[role.role] = role._count.id;
            return acc;
          }, {}),
          recentInvitations,
          expiringInvitations,
        };
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: "GET_INVITATION_STATS",
          resource: "UserInvitation",
          metadata: {
            source: "user-service",
            endpoint: "/api/invitations/stats",
            requestingRole: req.user.role,
            statsGenerated: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ stats }));
    } catch (error) {
      logger.error("Get invitation stats error", {
        error: error.message,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }
}

module.exports = UserInvitationController;
