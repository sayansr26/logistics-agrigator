/**
 * Label Generation Service
 *
 * Handles shipping label generation and manifest creation
 * Integrates with partner services for label formats
 * Follows established service patterns with file management
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const {
  APIError,
  ValidationError,
  NotFoundError,
} = require("../shared/lib/errors");
const partnerIntegrationService = require("./partnerIntegrationService");
const fs = require("fs").promises;
const path = require("path");

class LabelGenerationService {
  constructor() {
    // Redis client will be obtained when needed, following auth-service patterns
    this.labelFormats = {
      A4: { width: 210, height: 297 }, // A4 in mm
      A4_4: { width: 105, height: 74 }, // A4 divided into 4 labels
      "4x6": { width: 101.6, height: 152.4 }, // 4x6 inches in mm
      "6x4": { width: 152.4, height: 101.6 }, // 6x4 inches in mm
    };
  }

  /**
   * Generate shipping label for a single shipment
   */
  async generateShippingLabel(shipmentId, labelOptions = {}, userId = null) {
    try {
      logger.info("Generating shipping label", {
        service: "shipment-service",
        function: "generateShippingLabel",
        shipmentId,
        userId,
      });

      // Get shipment details
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          trackingEvents: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      });

      if (!shipment) {
        throw new NotFoundError(`Shipment not found: ${shipmentId}`);
      }

      // Validate shipment status for label generation
      const validStatuses = ["CREATED", "BOOKED", "PICKED_UP"];
      if (!validStatuses.includes(shipment.status)) {
        throw new ValidationError(
          `Cannot generate label for shipment with status: ${shipment.status}`,
        );
      }

      const {
        format = "4x6",
        includeBarcode = true,
        includeQRCode = true,
        labelType = "SHIPPING",
        copies = 1,
      } = labelOptions;

      // Validate label format
      if (!this.labelFormats[format]) {
        throw new ValidationError(`Invalid label format: ${format}`);
      }

      // Generate label content
      const labelContent = await this.createLabelContent(shipment, {
        format,
        includeBarcode,
        includeQRCode,
        labelType,
      });

      // Generate label file
      const labelFile = await this.generateLabelFile(
        labelContent,
        format,
        copies,
      );

      // Cache label in Redis for quick access
      try {
        const redisClient = getRedisClient();
        await redisClient.setex(
          `label:${shipmentId}`,
          86400, // 24 hours TTL
          JSON.stringify({
            shipmentId,
            labelPath: labelFile.filePath,
            format,
            generatedAt: new Date().toISOString(),
            userId,
          }),
        );
      } catch (redisError) {
        logger.warn("Redis caching failed", { error: redisError.message });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "GENERATE_LABEL",
          resource: "Shipment",
          resourceId: shipmentId,
          changes: {
            format,
            labelType,
            copies,
          },
          ipAddress: "127.0.0.1",
          userAgent: "LabelGenerationService",
        },
      });

      logger.info("Shipping label generated successfully", {
        shipmentId,
        format,
        filePath: labelFile.filePath,
      });

      return {
        shipmentId,
        orderId: shipment.orderId,
        awbNumber: shipment.awbNumber,
        label: {
          format,
          filePath: labelFile.filePath,
          fileSize: labelFile.fileSize,
          copies,
          generatedAt: new Date().toISOString(),
        },
        shipmentDetails: {
          status: shipment.status,
          partnerId: shipment.partnerId,
          partnerName: shipment.partnerName,
          serviceType: shipment.serviceType,
        },
      };
    } catch (error) {
      logger.error("Generate shipping label error", {
        shipmentId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Generate bulk shipping labels
   */
  async generateBulkLabels(shipmentIds, labelOptions = {}, userId = null) {
    try {
      logger.info("Generating bulk shipping labels", {
        totalShipments: shipmentIds.length,
        userId,
      });

      const results = {
        successful: [],
        failed: [],
        summary: {
          total: shipmentIds.length,
          successCount: 0,
          failureCount: 0,
        },
      };

      // Process in batches of 10 for better performance
      const batchSize = 10;
      const batches = this.createBatches(shipmentIds, batchSize);

      for (const batch of batches) {
        const batchPromises = batch.map((shipmentId) =>
          this.generateShippingLabel(shipmentId, labelOptions, userId)
            .then((result) => ({ success: true, ...result }))
            .catch((error) => ({
              success: false,
              shipmentId,
              error: error.message,
            })),
        );

        const batchResults = await Promise.all(batchPromises);

        // Process batch results
        batchResults.forEach((result) => {
          if (result.success) {
            results.successful.push(result);
            results.summary.successCount++;
          } else {
            results.failed.push({
              shipmentId: result.shipmentId,
              error: result.error,
            });
            results.summary.failureCount++;
          }
        });
      }

      return results;
    } catch (error) {
      logger.error("Bulk label generation error", {
        error: error.message,
        shipmentCount: shipmentIds.length,
      });
      throw new APIError(
        `Bulk label generation failed: ${error.message}`,
        500,
        "BULK_LABEL_ERROR",
      );
    }
  }

  /**
   * Create manifest for multiple shipments
   */
  async createManifest(manifestData, userId = null) {
    try {
      const {
        shipmentIds,
        partnerId,
        pickupDate,
        manifestType = "PICKUP",
        notes = null,
      } = manifestData;

      logger.info("Creating manifest", {
        manifestType,
        partnerId,
        shipmentCount: shipmentIds.length,
        pickupDate,
        userId,
      });

      // Validate shipments exist and belong to the same partner
      const shipments = await prisma.shipment.findMany({
        where: {
          id: {
            in: shipmentIds,
          },
        },
      });

      if (shipments.length !== shipmentIds.length) {
        throw new ValidationError(
          `Some shipments not found. Expected: ${shipmentIds.length}, Found: ${shipments.length}`,
        );
      }

      // Validate all shipments belong to the specified partner
      const invalidShipments = shipments.filter(
        (s) => s.partnerId !== partnerId,
      );
      if (invalidShipments.length > 0) {
        throw new ValidationError(
          `All shipments must belong to partner: ${partnerId}`,
        );
      }

      // Generate manifest ID
      const manifestId = `MAN${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Create manifest content
      const manifestContent = await this.createManifestContent(
        manifestId,
        shipments,
        partnerId,
        pickupDate,
        manifestType,
        notes,
      );

      // Generate manifest file
      const manifestFile = await this.generateManifestFile(
        manifestContent,
        manifestId,
      );

      // Cache manifest in Redis
      try {
        const redisClient = getRedisClient();
        await redisClient.setex(
          `manifest:${manifestId}`,
          86400 * 7, // 7 days TTL
          JSON.stringify({
            manifestId,
            partnerId,
            shipmentIds,
            filePath: manifestFile.filePath,
            generatedAt: new Date().toISOString(),
            userId,
          }),
        );
      } catch (redisError) {
        logger.warn("Redis caching failed", { error: redisError.message });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE_MANIFEST",
          resource: "Manifest",
          resourceId: manifestId,
          changes: {
            partnerId,
            manifestType,
            shipmentCount: shipments.length,
          },
          ipAddress: "127.0.0.1",
          userAgent: "LabelGenerationService",
        },
      });

      logger.info("Manifest created successfully", {
        manifestId,
        partnerId,
        shipmentCount: shipments.length,
      });

      return {
        manifestId,
        partnerId,
        manifest: {
          type: manifestType,
          filePath: manifestFile.filePath,
          fileSize: manifestFile.fileSize,
          generatedAt: new Date().toISOString(),
        },
        shipments: shipments.map((s) => ({
          id: s.id,
          orderId: s.orderId,
          awbNumber: s.awbNumber,
          weight: s.weight,
          totalCost: s.totalCost,
        })),
        summary: {
          totalShipments: shipments.length,
          totalWeight: shipments.reduce(
            (sum, s) => sum + parseFloat(s.weight),
            0,
          ),
          totalValue: shipments.reduce(
            (sum, s) => sum + parseFloat(s.totalCost),
            0,
          ),
        },
      };
    } catch (error) {
      logger.error("Create manifest error", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get courier-generated shipping label via partner-service
   * Uses actual courier API (Delhivery, BlueDart) for label generation
   */
  async getCourierLabel(shipmentId, format = "pdf", authToken = null) {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: {
          id: true,
          awbNumber: true,
          partnerId: true,
          partnerName: true,
          status: true,
        },
      });

      if (!shipment) {
        throw new NotFoundError(`Shipment not found: ${shipmentId}`);
      }

      if (!shipment.awbNumber || !shipment.partnerId) {
        throw new ValidationError(
          "Shipment has no AWB number or partner assigned. Use local label generation instead.",
        );
      }

      logger.info("Fetching courier label", {
        shipmentId,
        awbNumber: shipment.awbNumber,
        partnerId: shipment.partnerId,
        format,
      });

      const result = await partnerIntegrationService.getCourierLabel(
        shipment.partnerId,
        shipment.awbNumber,
        format,
        authToken,
      );

      return {
        shipmentId,
        awbNumber: shipment.awbNumber,
        partnerId: shipment.partnerId,
        partnerName: shipment.partnerName,
        label: result,
        source: "COURIER_API",
      };
    } catch (error) {
      logger.error("Get courier label error", {
        shipmentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get generated label or manifest
   */
  async getGeneratedDocument(documentId, documentType = "label") {
    try {
      const cacheKey = `${documentType}:${documentId}`;
      const redisClient = getRedisClient();
      const documentData = await redisClient.get(cacheKey);
      if (!documentData) {
        throw new NotFoundError(`${documentType} not found: ${documentId}`);
      }

      const document = JSON.parse(documentData);

      // Verify file still exists
      try {
        await fs.access(document.filePath);
        const stats = await fs.stat(document.filePath);

        return {
          ...document,
          fileSize: stats.size,
          exists: true,
        };
      } catch (error) {
        logger.warn("Generated document file not found", {
          documentId,
          filePath: document.filePath,
        });

        return {
          ...document,
          exists: false,
          error: "File not found",
        };
      }
    } catch (error) {
      logger.error("Get generated document error", {
        documentId,
        documentType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create label content data
   */
  async createLabelContent(shipment, options) {
    const { format, includeBarcode, includeQRCode, labelType } = options;

    return {
      shipmentInfo: {
        orderId: shipment.orderId,
        awbNumber: shipment.awbNumber,
        partnerId: shipment.partnerId,
        partnerName: shipment.partnerName,
        serviceType: shipment.serviceType,
        createdAt: shipment.createdAt,
      },
      pickupAddress: {
        name: shipment.pickupName,
        phone: shipment.pickupPhone,
        line1: shipment.pickupLine1,
        line2: shipment.pickupLine2,
        landmark: shipment.pickupLandmark,
        city: shipment.pickupCity,
        state: shipment.pickupState,
        pincode: shipment.pickupPincode,
        country: shipment.pickupCountry,
      },
      deliveryAddress: {
        name: shipment.deliveryName,
        phone: shipment.deliveryPhone,
        line1: shipment.deliveryLine1,
        line2: shipment.deliveryLine2,
        landmark: shipment.deliveryLandmark,
        city: shipment.deliveryCity,
        state: shipment.deliveryState,
        pincode: shipment.deliveryPincode,
        country: shipment.deliveryCountry,
      },
      packageInfo: {
        weight: shipment.weight,
        dimensions: `${shipment.length}x${shipment.width}x${shipment.height} cm`,
        description: shipment.description,
        paymentType: shipment.paymentType,
        codAmount: shipment.codAmount,
      },
      labelOptions: {
        format,
        includeBarcode,
        includeQRCode,
        labelType,
      },
    };
  }

  /**
   * Generate actual label file (stub implementation)
   */
  async generateLabelFile(labelContent, format, copies) {
    try {
      // Create labels directory if it doesn't exist
      const labelsDir = path.join(process.cwd(), "generated", "labels");
      await fs.mkdir(labelsDir, { recursive: true });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `label_${labelContent.shipmentInfo.awbNumber}_${timestamp}.pdf`;
      const filePath = path.join(labelsDir, filename);

      // Simulate PDF generation (in production, use libraries like PDFKit, jsPDF, etc.)
      const pdfContent = this.generatePDFContent(labelContent, format, copies);

      await fs.writeFile(filePath, pdfContent);

      const stats = await fs.stat(filePath);

      return {
        filePath,
        filename,
        fileSize: stats.size,
        format,
        copies,
      };
    } catch (error) {
      logger.error("Generate label file error", {
        error: error.message,
      });
      throw new APIError(
        `Label file generation failed: ${error.message}`,
        500,
        "LABEL_FILE_ERROR",
      );
    }
  }

  /**
   * Generate manifest file (stub implementation)
   */
  async generateManifestFile(manifestContent, manifestId) {
    try {
      // Create manifests directory if it doesn't exist
      const manifestsDir = path.join(process.cwd(), "generated", "manifests");
      await fs.mkdir(manifestsDir, { recursive: true });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `manifest_${manifestId}_${timestamp}.pdf`;
      const filePath = path.join(manifestsDir, filename);

      // Simulate PDF generation
      const pdfContent = this.generateManifestPDFContent(manifestContent);

      await fs.writeFile(filePath, pdfContent);

      const stats = await fs.stat(filePath);

      return {
        filePath,
        filename,
        fileSize: stats.size,
        manifestId,
      };
    } catch (error) {
      logger.error("Generate manifest file error", {
        manifestId,
        error: error.message,
      });
      throw new APIError(
        `Manifest file generation failed: ${error.message}`,
        500,
        "MANIFEST_FILE_ERROR",
      );
    }
  }

  /**
   * Create manifest content data
   */
  async createManifestContent(
    manifestId,
    shipments,
    partnerId,
    pickupDate,
    manifestType,
    notes,
  ) {
    return {
      manifestInfo: {
        id: manifestId,
        type: manifestType,
        partnerId,
        pickupDate,
        notes,
        generatedAt: new Date().toISOString(),
      },
      shipments: shipments.map((shipment) => ({
        orderId: shipment.orderId,
        awbNumber: shipment.awbNumber,
        pickupAddress: {
          name: shipment.pickupName,
          city: shipment.pickupCity,
          pincode: shipment.pickupPincode,
        },
        deliveryAddress: {
          name: shipment.deliveryName,
          city: shipment.deliveryCity,
          pincode: shipment.deliveryPincode,
        },
        weight: shipment.weight,
        paymentType: shipment.paymentType,
        codAmount: shipment.codAmount,
        totalCost: shipment.totalCost,
      })),
      summary: {
        totalShipments: shipments.length,
        totalWeight: shipments.reduce(
          (sum, s) => sum + parseFloat(s.weight),
          0,
        ),
        totalCodAmount: shipments
          .filter((s) => s.paymentType === "COD")
          .reduce((sum, s) => sum + parseFloat(s.codAmount || 0), 0),
        totalValue: shipments.reduce(
          (sum, s) => sum + parseFloat(s.totalCost),
          0,
        ),
        codShipments: shipments.filter((s) => s.paymentType === "COD").length,
        prepaidShipments: shipments.filter((s) => s.paymentType === "PREPAID")
          .length,
      },
    };
  }

  /**
   * Generate PDF content (stub implementation)
   */
  generatePDFContent(labelContent, format, copies) {
    // This is a stub implementation
    // In production, use proper PDF generation libraries
    const content = `
SHIPPING LABEL - ${format.toUpperCase()}
==============================

Order ID: ${labelContent.shipmentInfo.orderId}
AWB Number: ${labelContent.shipmentInfo.awbNumber}
Partner: ${labelContent.shipmentInfo.partnerName}
Service Type: ${labelContent.shipmentInfo.serviceType}

FROM:
${labelContent.pickupAddress.name}
${labelContent.pickupAddress.line1}
${labelContent.pickupAddress.line2 || ""}
${labelContent.pickupAddress.city}, ${labelContent.pickupAddress.state} ${labelContent.pickupAddress.pincode}
Phone: ${labelContent.pickupAddress.phone}

TO:
${labelContent.deliveryAddress.name}
${labelContent.deliveryAddress.line1}
${labelContent.deliveryAddress.line2 || ""}
${labelContent.deliveryAddress.city}, ${labelContent.deliveryAddress.state} ${labelContent.deliveryAddress.pincode}
Phone: ${labelContent.deliveryAddress.phone}

PACKAGE:
Weight: ${labelContent.packageInfo.weight}kg
Dimensions: ${labelContent.packageInfo.dimensions}
Payment: ${labelContent.packageInfo.paymentType}
${labelContent.packageInfo.paymentType === "COD" ? `COD Amount: ₹${labelContent.packageInfo.codAmount}` : ""}

Generated: ${new Date().toISOString()}
Copies: ${copies}
    `;

    return Buffer.from(content, "utf8");
  }

  /**
   * Generate manifest PDF content (stub implementation)
   */
  generateManifestPDFContent(manifestContent) {
    // This is a stub implementation
    const content = `
PICKUP MANIFEST
===============

Manifest ID: ${manifestContent.manifestInfo.id}
Partner ID: ${manifestContent.manifestInfo.partnerId}
Pickup Date: ${manifestContent.manifestInfo.pickupDate}
Generated: ${manifestContent.manifestInfo.generatedAt}

SUMMARY:
========
Total Shipments: ${manifestContent.summary.totalShipments}
Total Weight: ${manifestContent.summary.totalWeight}kg
Total COD Amount: ₹${manifestContent.summary.totalCodAmount}
Total Value: ₹${manifestContent.summary.totalValue}
COD Shipments: ${manifestContent.summary.codShipments}
Prepaid Shipments: ${manifestContent.summary.prepaidShipments}

SHIPMENTS:
==========
${manifestContent.shipments
  .map(
    (s, i) => `
${i + 1}. ${s.orderId} (${s.awbNumber})
   From: ${s.pickupAddress.name}, ${s.pickupAddress.city}
   To: ${s.deliveryAddress.name}, ${s.deliveryAddress.city}
   Weight: ${s.weight}kg, Payment: ${s.paymentType}
   ${s.paymentType === "COD" ? `COD: ₹${s.codAmount}` : ""}`,
  )
  .join("")}

Notes: ${manifestContent.manifestInfo.notes || "None"}
    `;

    return Buffer.from(content, "utf8");
  }

  /**
   * Utility methods
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

module.exports = new LabelGenerationService();
