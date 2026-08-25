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
const labelBrandingService = require("./labelBrandingService");
const { renderShippingLabelPdf } = require("./labelPdfRenderer");
const fs = require("fs").promises;
const path = require("path");

/**
 * Public tracking URL for a shipment, e.g. https://app.subsolution.in/track/<awb>.
 * Set PUBLIC_TRACKING_BASE_URL to override the host (falls back to
 * PLATFORM_WEBSITE, then the production app domain).
 */
function buildPublicTrackingUrl(awbNumber) {
  if (!awbNumber) return null;
  const configured =
    process.env.PUBLIC_TRACKING_BASE_URL ||
    process.env.PLATFORM_WEBSITE ||
    "app.subsolution.in";
  const base = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;
  return `${base.replace(/\/+$/, "")}/track/${encodeURIComponent(awbNumber)}`;
}

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

      await this.storeLabelDocument(shipment, labelContent, labelFile);

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
          data: labelFile.buffer.toString("base64"),
          contentType: "application/pdf",
        },
        branding: {
          source: labelContent.brand.source,
          brandName: labelContent.brand.brandName,
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
   * Keep the latest platform-rendered label on the shipment's documents.
   * Courier-fetched labels are stored separately (source PARTNER) so the
   * two never overwrite each other.
   */
  async storeLabelDocument(shipment, labelContent, labelFile) {
    try {
      const existing = await prisma.shipmentDocument.findFirst({
        where: { shipmentId: shipment.id, type: "LABEL", source: "SYSTEM" },
        select: { id: true },
      });

      const documentData = {
        name: `Shipping Label - ${labelContent.brand.brandName} - ${
          shipment.awbNumber || shipment.orderId
        }`,
        data: labelFile.buffer.toString("base64"),
        format: "pdf",
        source: "SYSTEM",
        metadata: {
          labelFormat: labelFile.format,
          copies: labelFile.copies,
          brandSource: labelContent.brand.source,
          brandName: labelContent.brand.brandName,
        },
        fetchedAt: new Date(),
      };

      if (existing) {
        await prisma.shipmentDocument.update({
          where: { id: existing.id },
          data: documentData,
        });
      } else {
        await prisma.shipmentDocument.create({
          data: { shipmentId: shipment.id, type: "LABEL", ...documentData },
        });
      }
    } catch (error) {
      // The caller still gets the PDF; only the stored copy is lost.
      logger.warn("Failed to store generated label document", {
        shipmentId: shipment.id,
        error: error.message,
      });
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
   * Build the label content. The shipper block is the outlet / client the
   * end customer dealt with (white-label), never the aggregator account.
   */
  async createLabelContent(shipment, options) {
    const { format, includeBarcode, includeQRCode, labelType } = options;

    const brand = await labelBrandingService.resolveShipperBranding({
      outletId: shipment.outletId,
      clientId: shipment.clientId,
      pickup: {
        name: shipment.pickupName,
        phone: shipment.pickupPhone,
        line1: shipment.pickupLine1,
        line2: shipment.pickupLine2,
        city: shipment.pickupCity,
        state: shipment.pickupState,
        pincode: shipment.pickupPincode,
      },
    });

    // The parcel returns to the RTO address when one is set, else pickup.
    const returnAddress =
      !shipment.rtoSameAsPickup && shipment.rtoLine1
        ? {
            name: brand.brandName,
            phone: shipment.rtoPhone,
            line1: shipment.rtoLine1,
            line2: shipment.rtoLine2,
            city: shipment.rtoCity,
            state: shipment.rtoState,
            pincode: shipment.rtoPincode,
          }
        : {
            name: brand.brandName,
            phone: shipment.pickupPhone,
            line1: shipment.pickupLine1,
            line2: shipment.pickupLine2,
            city: shipment.pickupCity,
            state: shipment.pickupState,
            pincode: shipment.pickupPincode,
          };

    const num = (value) => {
      if (value === null || value === undefined) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const dims = [shipment.length, shipment.width, shipment.height]
      .map(num)
      .filter((v) => v !== null);

    return {
      brand,
      courier: {
        partnerName: shipment.partnerName,
        serviceType: shipment.serviceType,
        channelName: shipment.courierChannelName,
      },
      shipmentInfo: {
        orderId: shipment.orderId,
        awbNumber: shipment.awbNumber,
        // Our own tracking page, never the courier's. The label is white-
        // labelled with the outlet/client brand, so sending the recipient to
        // the courier's site leaks the carrier and drops them out of our
        // funnel. The courier URL stays on the shipment row for internal use.
        trackingUrl: buildPublicTrackingUrl(shipment.awbNumber),
        courierTrackingUrl: shipment.trackingUrl,
        shipmentType: shipment.shipmentType,
        fragile: !!shipment.fragile,
        partnerId: shipment.partnerId,
        partnerName: shipment.partnerName,
        serviceType: shipment.serviceType,
        createdAt: shipment.createdAt,
      },
      payment: {
        paymentType: shipment.paymentType,
        codAmount: num(shipment.codAmount),
        declaredValue: num(shipment.value),
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
      returnAddress,
      packageInfo: {
        description: shipment.productDescription || shipment.description,
        hsnCode: shipment.hsnCode,
        quantity: shipment.numberOfBoxes || 1,
        weight: num(shipment.weight),
        chargeableWeight:
          num(shipment.chargeableWeight) ?? num(shipment.weight),
        dimensions: dims.length === 3 ? dims.join(" x ") : null,
        paymentType: shipment.paymentType,
        codAmount: num(shipment.codAmount),
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
   * Render the label PDF and persist a copy under generated/labels.
   */
  async generateLabelFile(labelContent, format, copies) {
    try {
      const labelsDir = path.join(process.cwd(), "generated", "labels");
      await fs.mkdir(labelsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const reference =
        labelContent.shipmentInfo.awbNumber ||
        labelContent.shipmentInfo.orderId;
      const filename = `label_${reference}_${timestamp}.pdf`;
      const filePath = path.join(labelsDir, filename);

      const pdfBuffer = await renderShippingLabelPdf(labelContent, {
        format,
        copies,
      });

      await fs.writeFile(filePath, pdfBuffer);

      return {
        filePath,
        filename,
        fileSize: pdfBuffer.length,
        format,
        copies,
        buffer: pdfBuffer,
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
