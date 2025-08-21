// Client Settings Controller - White-label branding and configuration
// Handles client settings CRUD operations for branding, features, and integrations

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const {
  ClientNotFoundError,
  UserServiceError,
} = require("../middleware/errorHandler");

const prisma = new PrismaClient();

class ClientSettingsController {
  // Create client settings
  static async createClientSettings(req, res) {
    try {
      const {
        clientId,
        brandName,
        logo,
        primaryColor,
        secondaryColor,
        favicon,
        features,
        limits,
        integrations,
        emailFromName,
        emailFromAddress,
        emailTemplates,
      } = req.body;

      // Verify client exists and user has access
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { clientSettings: true },
      });

      if (!client) {
        throw new ClientNotFoundError(clientId);
      }

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.clientId !== clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only manage settings for your own client.",
          "CLIENT_SETTINGS_ACCESS_DENIED",
          403,
        );
      }

      // Check if settings already exist
      if (client.clientSettings) {
        throw new UserServiceError(
          "Client settings already exist. Use update endpoint instead.",
          "CLIENT_SETTINGS_EXISTS",
          409,
        );
      }

      // Create client settings with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const settings = await tx.clientSettings.create({
          data: {
            clientId,
            brandName,
            logo,
            primaryColor,
            secondaryColor,
            favicon,
            features,
            limits,
            integrations,
            emailFromName,
            emailFromAddress,
            emailTemplates,
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
            action: "CREATE_CLIENT_SETTINGS",
            resource: "ClientSettings",
            resourceId: settings.id,
            changes: {
              created: {
                brandName: settings.brandName,
                primaryColor: settings.primaryColor,
                secondaryColor: settings.secondaryColor,
                featuresEnabled: Object.keys(settings.features || {}),
              },
            },
            metadata: {
              source: "user-service",
              endpoint: "/api/client-settings",
              createdBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return settings;
      });

      logger.info("Client settings created successfully", {
        clientId,
        settingsId: result.id,
        createdBy: req.user.userId,
        service: "user-service",
      });

      res.status(201).json(
        APIResponse.success(
          {
            settings: result,
            message: "Client settings created successfully",
          },
          201,
        ),
      );
    } catch (error) {
      logger.error("Create client settings error", {
        error: error.message,
        userId: req.user.userId,
        requestBody: req.body,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get client settings
  static async getClientSettings(req, res) {
    try {
      const { clientId } = req.params;

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.role !== "support" &&
        req.user.clientId !== clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only view settings for your own client.",
          "CLIENT_SETTINGS_ACCESS_DENIED",
          403,
        );
      }

      const settings = await prisma.clientSettings.findUnique({
        where: { clientId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
              domain: true,
              isActive: true,
              subscriptionTier: true,
            },
          },
        },
      });

      if (!settings) {
        // Return default settings structure if none exist
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            isActive: true,
            subscriptionTier: true,
          },
        });

        if (!client) {
          throw new ClientNotFoundError(clientId);
        }

        return res.json(
          APIResponse.success({
            settings: null,
            client,
            message: "No settings found. Use POST to create initial settings.",
          }),
        );
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          clientId,
          action: "GET_CLIENT_SETTINGS",
          resource: "ClientSettings",
          resourceId: settings.id,
          metadata: {
            source: "user-service",
            endpoint: `/api/client-settings/${clientId}`,
            requestingRole: req.user.role,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ settings }));
    } catch (error) {
      logger.error("Get client settings error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Update client settings
  static async updateClientSettings(req, res) {
    try {
      const { clientId } = req.params;
      const updateData = req.body;

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.clientId !== clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only update settings for your own client.",
          "CLIENT_SETTINGS_UPDATE_DENIED",
          403,
        );
      }

      // Get current settings for audit trail
      const currentSettings = await prisma.clientSettings.findUnique({
        where: { clientId },
      });

      if (!currentSettings) {
        throw new UserServiceError(
          "Client settings not found. Use POST to create initial settings.",
          "CLIENT_SETTINGS_NOT_FOUND",
          404,
        );
      }

      // Update settings with transaction for audit logging
      const result = await prisma.$transaction(async (tx) => {
        const updatedSettings = await tx.clientSettings.update({
          where: { clientId },
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
          if (JSON.stringify(currentSettings[key]) !== JSON.stringify(updateData[key])) {
            changes[key] = {
              before: currentSettings[key],
              after: updateData[key],
            };
          }
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId,
            action: "UPDATE_CLIENT_SETTINGS",
            resource: "ClientSettings",
            resourceId: updatedSettings.id,
            changes,
            metadata: {
              source: "user-service",
              endpoint: `/api/client-settings/${clientId}`,
              updatedBy: req.user.role,
              fieldsUpdated: Object.keys(updateData),
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });

        return updatedSettings;
      });

      logger.info("Client settings updated successfully", {
        clientId,
        settingsId: result.id,
        updatedFields: Object.keys(updateData),
        updatedBy: req.user.userId,
        service: "user-service",
      });

      res.json(
        APIResponse.success({
          settings: result,
          message: "Client settings updated successfully",
        }),
      );
    } catch (error) {
      logger.error("Update client settings error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        updateData: req.body,
        service: "user-service",
      });
      throw error;
    }
  }

  // Delete client settings (reset to defaults)
  static async deleteClientSettings(req, res) {
    try {
      const { clientId } = req.params;

      // Only admins can delete client settings
      if (req.user.role !== "admin") {
        throw new UserServiceError(
          "Access denied. Only administrators can delete client settings.",
          "CLIENT_SETTINGS_DELETE_DENIED",
          403,
        );
      }

      const settings = await prisma.clientSettings.findUnique({
        where: { clientId },
      });

      if (!settings) {
        throw new UserServiceError(
          "Client settings not found.",
          "CLIENT_SETTINGS_NOT_FOUND",
          404,
        );
      }

      // Delete settings with transaction for audit logging
      await prisma.$transaction(async (tx) => {
        await tx.clientSettings.delete({
          where: { clientId },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            clientId,
            action: "DELETE_CLIENT_SETTINGS",
            resource: "ClientSettings",
            resourceId: settings.id,
            changes: {
              deleted: {
                brandName: settings.brandName,
                primaryColor: settings.primaryColor,
                secondaryColor: settings.secondaryColor,
                resetToDefaults: true,
              },
            },
            metadata: {
              source: "user-service",
              endpoint: `/api/client-settings/${clientId}`,
              deletedBy: req.user.role,
            },
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
        });
      });

      logger.warn("Client settings deleted", {
        clientId,
        settingsId: settings.id,
        deletedBy: req.user.userId,
        service: "user-service",
      });

      res.json(
        APIResponse.success({
          message: "Client settings deleted successfully. Client will use default settings.",
          clientId,
        }),
      );
    } catch (error) {
      logger.error("Delete client settings error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }

  // Get public branding settings (no authentication required)
  static async getPublicBranding(req, res) {
    try {
      const { slug } = req.params;

      const client = await prisma.client.findUnique({
        where: { slug, isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          clientSettings: {
            select: {
              brandName: true,
              logo: true,
              primaryColor: true,
              secondaryColor: true,
              favicon: true,
            },
          },
        },
      });

      if (!client) {
        throw new UserServiceError(
          `Client with slug '${slug}' not found or inactive`,
          "CLIENT_NOT_FOUND",
          404,
        );
      }

      // Create audit log (no user context for public endpoint)
      await prisma.auditLog.create({
        data: {
          clientId: client.id,
          action: "GET_PUBLIC_BRANDING",
          resource: "ClientSettings",
          metadata: {
            source: "user-service",
            endpoint: `/api/public/branding/${slug}`,
            publicAccess: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      const branding = {
        client: {
          name: client.name,
          slug: client.slug,
          domain: client.domain,
        },
        branding: client.clientSettings || {
          brandName: client.name,
          logo: null,
          primaryColor: "#3B82F6", // Default blue
          secondaryColor: "#64748B", // Default gray
          favicon: null,
        },
      };

      res.json(APIResponse.success({ branding }));
    } catch (error) {
      logger.error("Get public branding error", {
        error: error.message,
        slug: req.params.slug,
        service: "user-service",
      });
      throw error;
    }
  }

  // Validate branding configuration
  static async validateBranding(req, res) {
    try {
      const { clientId } = req.params;

      // Role-based access control
      if (
        req.user.role !== "admin" &&
        req.user.clientId !== clientId
      ) {
        throw new UserServiceError(
          "Access denied. You can only validate branding for your own client.",
          "CLIENT_BRANDING_VALIDATION_DENIED",
          403,
        );
      }

      const settings = await prisma.clientSettings.findUnique({
        where: { clientId },
        include: {
          client: {
            select: {
              name: true,
              slug: true,
              domain: true,
            },
          },
        },
      });

      if (!settings) {
        return res.json(
          APIResponse.success({
            valid: false,
            issues: ["No branding settings configured"],
            recommendations: [
              "Create initial branding settings",
              "Set brand name and colors",
              "Upload logo and favicon",
            ],
          }),
        );
      }

      const validation = {
        valid: true,
        issues: [],
        recommendations: [],
        completeness: {},
      };

      // Check branding completeness
      const brandingFields = {
        brandName: settings.brandName,
        logo: settings.logo,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        favicon: settings.favicon,
      };

      Object.entries(brandingFields).forEach(([field, value]) => {
        validation.completeness[field] = !!value;
        if (!value) {
          validation.issues.push(`Missing ${field}`);
          validation.recommendations.push(`Set ${field} for better branding`);
        }
      });

      // Validate color formats
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (settings.primaryColor && !colorRegex.test(settings.primaryColor)) {
        validation.valid = false;
        validation.issues.push("Invalid primary color format");
        validation.recommendations.push("Use hex color format (#RRGGBB)");
      }

      if (settings.secondaryColor && !colorRegex.test(settings.secondaryColor)) {
        validation.valid = false;
        validation.issues.push("Invalid secondary color format");
        validation.recommendations.push("Use hex color format (#RRGGBB)");
      }

      // Check URL formats for logo and favicon
      const urlRegex = /^https?:\/\/.+/;
      if (settings.logo && !urlRegex.test(settings.logo)) {
        validation.valid = false;
        validation.issues.push("Invalid logo URL format");
        validation.recommendations.push("Use valid HTTPS URL for logo");
      }

      if (settings.favicon && !urlRegex.test(settings.favicon)) {
        validation.valid = false;
        validation.issues.push("Invalid favicon URL format");
        validation.recommendations.push("Use valid HTTPS URL for favicon");
      }

      // Calculate completeness score
      const completedFields = Object.values(validation.completeness).filter(Boolean).length;
      const totalFields = Object.keys(validation.completeness).length;
      validation.completenessScore = Math.round((completedFields / totalFields) * 100);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          clientId,
          action: "VALIDATE_CLIENT_BRANDING",
          resource: "ClientSettings",
          resourceId: settings.id,
          metadata: {
            source: "user-service",
            endpoint: `/api/client-settings/${clientId}/validate`,
            validationResult: {
              valid: validation.valid,
              completenessScore: validation.completenessScore,
              issueCount: validation.issues.length,
            },
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      res.json(APIResponse.success({ validation }));
    } catch (error) {
      logger.error("Validate branding error", {
        error: error.message,
        clientId: req.params.clientId,
        userId: req.user.userId,
        service: "user-service",
      });
      throw error;
    }
  }
}

module.exports = ClientSettingsController;
