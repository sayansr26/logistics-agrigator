/**
 * Pickup Scheduling Service
 *
 * Handles pickup scheduling and management with courier partners
 * Manages pickup coordination and tracking
 * Follows established service patterns with partner integration
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

class PickupSchedulingService {
  constructor() {
    // Redis client will be obtained when needed, following auth-service patterns
    this.timeSlots = [
      "09:00-12:00",
      "10:00-13:00",
      "11:00-14:00",
      "12:00-15:00",
      "14:00-17:00",
      "15:00-18:00",
    ];
  }

  /**
   * Schedule pickup for single or multiple shipments
   */
  async schedulePickup(pickupData, userId, clientId = null) {
    try {
      logger.info("Scheduling pickup", {
        service: "shipment-service",
        function: "schedulePickup",
        userId,
        clientId,
      });

      const {
        shipmentIds = [],
        partnerId,
        scheduledDate,
        timeSlot = "10:00-13:00",
        pickupAddress,
        specialInstructions = null,
      } = pickupData;

      // Validate input data
      this.validatePickupData(pickupData);

      // Get shipment details
      const shipments = await prisma.shipment.findMany({
        where: {
          id: {
            in: shipmentIds,
          },
          ...(clientId ? { clientId } : {}),
        },
      });

      if (shipments.length !== shipmentIds.length) {
        throw new ValidationError(
          `Some shipments not found. Expected: ${shipmentIds.length}, Found: ${shipments.length}`,
        );
      }

      // Validate all shipments can be picked up
      const invalidShipments = shipments.filter(
        (s) => !["CREATED", "BOOKED"].includes(s.status),
      );
      if (invalidShipments.length > 0) {
        throw new ValidationError(
          `Cannot schedule pickup for shipments with status other than CREATED or BOOKED`,
        );
      }

      // Validate all shipments belong to the same partner
      if (partnerId) {
        const partnerMismatch = shipments.filter(
          (s) => s.partnerId !== partnerId,
        );
        if (partnerMismatch.length > 0) {
          throw new ValidationError(
            `All shipments must belong to the specified partner: ${partnerId}`,
          );
        }
      }

      // Get partner details
      const partnerName = shipments[0]?.partnerName || "Unknown Partner";

      // Calculate pickup statistics
      const totalWeight = shipments.reduce(
        (sum, s) => sum + parseFloat(s.weight || 0),
        0,
      );

      // Create pickup schedule record
      const pickupSchedule = await prisma.pickupSchedule.create({
        data: {
          clientId,
          userId,
          partnerId: partnerId || shipments[0].partnerId,
          partnerName,
          scheduledDate: new Date(scheduledDate),
          timeSlot,
          status: "SCHEDULED",

          // Address details
          pickupName: pickupAddress.name,
          pickupPhone: pickupAddress.phone,
          pickupEmail: pickupAddress.email,
          pickupLine1: pickupAddress.line1,
          pickupLine2: pickupAddress.line2,
          pickupLandmark: pickupAddress.landmark,
          pickupCity: pickupAddress.city,
          pickupState: pickupAddress.state,
          pickupPincode: pickupAddress.pincode,
          pickupCountry: pickupAddress.country || "India",

          // Pickup details
          totalShipments: shipments.length,
          totalWeight,
          specialInstructions,
        },
      });

      // Update shipments with pickup schedule
      if (shipmentIds.length > 0) {
        await prisma.shipment.updateMany({
          where: {
            id: {
              in: shipmentIds,
            },
          },
          data: {
            pickupScheduleId: pickupSchedule.id,
          },
        });
      }

      // Try to coordinate with partner (if integration available)
      let partnerResponse = null;
      try {
        partnerResponse = await this.coordinateWithPartner(pickupSchedule);
      } catch (error) {
        logger.warn("Partner coordination failed", {
          pickupScheduleId: pickupSchedule.id,
          error: error.message,
        });
      }

      // Cache pickup schedule for quick access
      try {
        const redisClient = getRedisClient();
        await redisClient.setex(
          `pickup:${pickupSchedule.id}`,
          86400, // 24 hours TTL
          JSON.stringify({
            pickupScheduleId: pickupSchedule.id,
            partnerId,
            scheduledDate,
            timeSlot,
            totalShipments: shipments.length,
            status: pickupSchedule.status,
          }),
        );
      } catch (redisError) {
        logger.warn("Redis caching failed", { error: redisError.message });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "SCHEDULE_PICKUP",
          resource: "PickupSchedule",
          resourceId: pickupSchedule.id,
          changes: {
            partnerId,
            shipmentCount: shipments.length,
            scheduledDate,
            timeSlot,
          },
          ipAddress: "127.0.0.1",
          userAgent: "PickupSchedulingService",
        },
      });

      logger.info("Pickup scheduled successfully", {
        pickupScheduleId: pickupSchedule.id,
        partnerId,
        shipmentCount: shipments.length,
      });

      return {
        pickupSchedule: {
          id: pickupSchedule.id,
          partnerId,
          partnerName,
          scheduledDate,
          timeSlot,
          status: pickupSchedule.status,
          totalShipments: shipments.length,
          totalWeight,
          confirmationCode: pickupSchedule.confirmationCode,
        },
        shipments: shipments.map((s) => ({
          id: s.id,
          orderId: s.orderId,
          awbNumber: s.awbNumber,
          weight: s.weight,
        })),
        partnerResponse,
      };
    } catch (error) {
      logger.error("Schedule pickup error", {
        error: error.message,
        stack: error.stack,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get pickup schedules with filtering
   */
  async getPickupSchedules(filters = {}, pagination = {}) {
    try {
      const {
        status,
        partnerId,
        userId,
        clientId,
        dateFrom,
        dateTo,
        scheduledDate,
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = "scheduledDate",
        sortOrder = "asc",
      } = pagination;

      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = {
        AND: [],
      };

      if (status) {
        whereClause.AND.push({ status });
      }

      if (partnerId) {
        whereClause.AND.push({ partnerId });
      }

      if (userId) {
        whereClause.AND.push({ userId });
      }

      if (clientId) {
        whereClause.AND.push({ clientId });
      }

      if (scheduledDate) {
        const startOfDay = new Date(scheduledDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(scheduledDate);
        endOfDay.setHours(23, 59, 59, 999);

        whereClause.AND.push({
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        });
      }

      if (dateFrom || dateTo) {
        const dateFilter = {};
        if (dateFrom) {
          dateFilter.gte = new Date(dateFrom);
        }
        if (dateTo) {
          dateFilter.lte = new Date(dateTo);
        }
        whereClause.AND.push({
          scheduledDate: dateFilter,
        });
      }

      // Remove empty AND array if no filters
      if (whereClause.AND.length === 0) {
        delete whereClause.AND;
      }

      const [pickupSchedules, totalCount] = await Promise.all([
        prisma.pickupSchedule.findMany({
          where: whereClause,
          include: {
            shipments: {
              select: {
                id: true,
                orderId: true,
                awbNumber: true,
                weight: true,
                totalCost: true,
                status: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip: offset,
          take: parseInt(limit),
        }),
        prisma.pickupSchedule.count({
          where: whereClause,
        }),
      ]);

      return {
        pickupSchedules: pickupSchedules.map((ps) => ({
          ...ps,
          shipmentsCount: ps.shipments.length,
          totalWeight: ps.shipments.reduce(
            (sum, s) => sum + parseFloat(s.weight || 0),
            0,
          ),
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
        summary: await this.getPickupSummary(whereClause),
      };
    } catch (error) {
      logger.error("Get pickup schedules error", {
        error: error.message,
        filters,
      });
      throw new APIError(
        `Failed to retrieve pickup schedules: ${error.message}`,
        500,
        "PICKUP_RETRIEVAL_ERROR",
      );
    }
  }

  /**
   * Update pickup schedule status
   */
  async updatePickupStatus(pickupScheduleId, statusData, userId) {
    try {
      logger.info("Updating pickup status", {
        pickupScheduleId,
        newStatus: statusData.status,
        userId,
      });

      const pickupSchedule = await prisma.pickupSchedule.findUnique({
        where: { id: pickupScheduleId },
        include: {
          shipments: true,
        },
      });

      if (!pickupSchedule) {
        throw new NotFoundError(
          `Pickup schedule not found: ${pickupScheduleId}`,
        );
      }

      const {
        status,
        pickedUpBy = null,
        actualWeight = null,
        actualShipments = null,
        pickupNotes = null,
      } = statusData;

      // Validate status transition
      this.validateStatusTransition(pickupSchedule.status, status);

      const updateData = {
        status,
        pickupNotes,
      };

      // Add pickup completion data if status is COMPLETED
      if (status === "COMPLETED") {
        updateData.pickedUpAt = new Date();
        updateData.pickedUpBy = pickedUpBy;
        updateData.actualWeight = actualWeight;
        updateData.actualShipments = actualShipments;

        // Update shipment statuses to PICKED_UP
        await prisma.shipment.updateMany({
          where: {
            pickupScheduleId,
          },
          data: {
            status: "PICKED_UP",
            actualPickup: new Date(),
          },
        });
      }

      const updatedPickupSchedule = await prisma.pickupSchedule.update({
        where: { id: pickupScheduleId },
        data: updateData,
      });

      // Clear cache
      if (this.redisClient) {
        await this.redisClient.del(`pickup:${pickupScheduleId}`);
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "UPDATE_PICKUP_STATUS",
          resource: "PickupSchedule",
          resourceId: pickupScheduleId,
          changes: {
            previousStatus: pickupSchedule.status,
            newStatus: status,
            pickedUpBy,
            actualWeight,
            actualShipments,
          },
          ipAddress: "127.0.0.1",
          userAgent: "PickupSchedulingService",
        },
      });

      logger.info("Pickup status updated successfully", {
        pickupScheduleId,
        previousStatus: pickupSchedule.status,
        newStatus: status,
      });

      return updatedPickupSchedule;
    } catch (error) {
      logger.error("Update pickup status error", {
        pickupScheduleId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel pickup schedule
   */
  async cancelPickup(pickupScheduleId, cancellationReason, userId) {
    try {
      logger.info("Cancelling pickup", {
        pickupScheduleId,
        cancellationReason,
        userId,
      });

      const pickupSchedule = await prisma.pickupSchedule.findUnique({
        where: { id: pickupScheduleId },
        include: {
          shipments: true,
        },
      });

      if (!pickupSchedule) {
        throw new NotFoundError(
          `Pickup schedule not found: ${pickupScheduleId}`,
        );
      }

      // Can only cancel scheduled or confirmed pickups
      if (!["SCHEDULED", "CONFIRMED"].includes(pickupSchedule.status)) {
        throw new ValidationError(
          `Cannot cancel pickup with status: ${pickupSchedule.status}`,
        );
      }

      // Update pickup schedule status
      const updatedPickupSchedule = await prisma.pickupSchedule.update({
        where: { id: pickupScheduleId },
        data: {
          status: "CANCELLED",
          pickupNotes: cancellationReason,
        },
      });

      // Remove pickup schedule from shipments
      await prisma.shipment.updateMany({
        where: {
          pickupScheduleId,
        },
        data: {
          pickupScheduleId: null,
        },
      });

      // Clear cache
      if (this.redisClient) {
        await this.redisClient.del(`pickup:${pickupScheduleId}`);
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CANCEL_PICKUP",
          resource: "PickupSchedule",
          resourceId: pickupScheduleId,
          changes: {
            cancellationReason,
            affectedShipments: pickupSchedule.shipments.length,
          },
          ipAddress: "127.0.0.1",
          userAgent: "PickupSchedulingService",
        },
      });

      logger.info("Pickup cancelled successfully", {
        pickupScheduleId,
        affectedShipments: pickupSchedule.shipments.length,
      });

      return updatedPickupSchedule;
    } catch (error) {
      logger.error("Cancel pickup error", {
        pickupScheduleId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get available time slots for a date
   */
  async getAvailableTimeSlots(date, partnerId = null) {
    try {
      const selectedDate = new Date(date);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get existing bookings for the date
      const whereClause = {
        scheduledDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"],
        },
      };

      if (partnerId) {
        whereClause.partnerId = partnerId;
      }

      const existingBookings = await prisma.pickupSchedule.findMany({
        where: whereClause,
        select: {
          timeSlot: true,
          partnerId: true,
        },
      });

      // Calculate availability for each time slot
      const availability = this.timeSlots.map((timeSlot) => {
        const bookingsForSlot = existingBookings.filter(
          (booking) => booking.timeSlot === timeSlot,
        );

        return {
          timeSlot,
          available: bookingsForSlot.length < 5, // Max 5 pickups per slot
          currentBookings: bookingsForSlot.length,
          maxCapacity: 5,
        };
      });

      return {
        date: selectedDate.toISOString().split("T")[0],
        partnerId,
        timeSlots: availability,
        summary: {
          totalSlots: this.timeSlots.length,
          availableSlots: availability.filter((slot) => slot.available).length,
          bookedSlots: availability.filter((slot) => !slot.available).length,
        },
      };
    } catch (error) {
      logger.error("Get available time slots error", {
        date,
        partnerId,
        error: error.message,
      });
      throw new APIError(
        `Failed to get time slots: ${error.message}`,
        500,
        "TIME_SLOTS_ERROR",
      );
    }
  }

  /**
   * Coordinate with partner for pickup
   * Attempts to schedule pickup via courier API through partner-service.
   * Falls back to local scheduling if courier API fails.
   */
  async coordinateWithPartner(pickupSchedule) {
    try {
      logger.info("Coordinating pickup with partner", {
        pickupScheduleId: pickupSchedule.id,
        partnerId: pickupSchedule.partnerId,
      });

      // Try to schedule via courier API through partner-service
      let courierResult = null;
      try {
        courierResult = await partnerIntegrationService.requestCourierPickup(
          pickupSchedule.partnerId,
          {
            pickupAddress: {
              name: pickupSchedule.pickupName,
              phone: pickupSchedule.pickupPhone,
              address: pickupSchedule.pickupLine1,
              city: pickupSchedule.pickupCity,
              state: pickupSchedule.pickupState,
              pincode: pickupSchedule.pickupPincode,
            },
            pickupDate: pickupSchedule.scheduledDate,
            packageCount: pickupSchedule.totalShipments,
            pickupTime: pickupSchedule.timeSlot?.split("-")[0] || "10:00",
          },
        );
      } catch (courierError) {
        logger.warn(
          "Courier API pickup scheduling failed - using local scheduling",
          {
            pickupScheduleId: pickupSchedule.id,
            error: courierError.message,
          },
        );
      }

      const partnerRequestId =
        courierResult?.courierResponse?.pickupId ||
        `REQ${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;
      const confirmationCode = `PU${Math.random().toString(36).substring(7).toUpperCase()}`;

      // Update pickup schedule with partner response
      await prisma.pickupSchedule.update({
        where: { id: pickupSchedule.id },
        data: {
          partnerRequestId,
          confirmationCode,
          partnerResponse: {
            requestId: partnerRequestId,
            confirmationCode,
            status: courierResult ? "ACCEPTED" : "LOCAL_ONLY",
            estimatedPickupTime: pickupSchedule.scheduledDate,
            courierResponse: courierResult || null,
          },
          status: "CONFIRMED",
        },
      });

      return {
        success: true,
        partnerRequestId,
        confirmationCode,
        status: "CONFIRMED",
        courierBooked: !!courierResult,
        message: courierResult
          ? "Pickup request confirmed by courier partner"
          : "Pickup scheduled locally (courier API unavailable)",
      };
    } catch (error) {
      logger.error("Partner coordination error", {
        pickupScheduleId: pickupSchedule.id,
        error: error.message,
      });

      // Don't throw error for partner coordination failures
      return {
        success: false,
        error: error.message,
        message: "Partner coordination failed, pickup scheduled locally",
      };
    }
  }

  /**
   * Validation methods
   */
  validatePickupData(pickupData) {
    const { scheduledDate, timeSlot, pickupAddress } = pickupData;

    // Validate scheduled date (must be future date)
    const selectedDate = new Date(scheduledDate);
    const now = new Date();
    if (selectedDate <= now) {
      throw new ValidationError("Scheduled date must be in the future");
    }

    // Validate time slot
    if (!this.timeSlots.includes(timeSlot)) {
      throw new ValidationError(
        `Invalid time slot. Available slots: ${this.timeSlots.join(", ")}`,
      );
    }

    // Validate pickup address
    const requiredFields = [
      "name",
      "phone",
      "line1",
      "city",
      "state",
      "pincode",
    ];
    for (const field of requiredFields) {
      if (!pickupAddress[field]) {
        throw new ValidationError(`Pickup address ${field} is required`);
      }
    }

    // Validate phone format
    if (!/^\+91-[0-9]{10}$/.test(pickupAddress.phone)) {
      throw new ValidationError(
        "Invalid phone format. Expected format: +91-9876543210",
      );
    }

    // Validate pincode
    if (!/^[0-9]{6}$/.test(pickupAddress.pincode)) {
      throw new ValidationError("Invalid pincode. Must be 6 digits.");
    }
  }

  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      SCHEDULED: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "FAILED"],
      COMPLETED: [],
      CANCELLED: [],
      FAILED: ["SCHEDULED"], // Can reschedule failed pickup
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Get pickup summary statistics
   */
  async getPickupSummary(whereClause = {}) {
    try {
      const [statusCounts, partnerCounts] = await Promise.all([
        prisma.pickupSchedule.groupBy({
          by: ["status"],
          where: whereClause,
          _count: true,
        }),
        prisma.pickupSchedule.groupBy({
          by: ["partnerId"],
          where: whereClause,
          _count: true,
        }),
      ]);

      return {
        statusDistribution: statusCounts.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        partnerDistribution: partnerCounts.map((p) => ({
          partnerId: p.partnerId,
          count: p._count,
        })),
      };
    } catch (error) {
      logger.error("Get pickup summary error", {
        error: error.message,
      });
      return {
        statusDistribution: [],
        partnerDistribution: [],
      };
    }
  }
}

module.exports = new PickupSchedulingService();
