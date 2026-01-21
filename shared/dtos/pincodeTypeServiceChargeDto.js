/**
 * Pincode Type Service Charge DTOs
 *
 * Data Transfer Objects for pincode type service charge management.
 * These provide a standard contract for the API responses.
 */

/**
 * Pincode Type Service Charge DTO
 * Represents a single service charge for a pincode type x partner combination
 */
class PincodeTypeServiceChargeDTO {
  constructor(data) {
    this.id = data.id;
    this.pincodeType = data.pincodeType;
    this.partner = data.partner;
    this.baseCharge = data.baseCharge;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Create from Prisma model
   */
  static fromPrisma(charge) {
    return new PincodeTypeServiceChargeDTO({
      id: charge.id,
      pincodeType: {
        id: charge.pincodeType.id,
        name: charge.pincodeType.name,
        description: charge.pincodeType.description,
      },
      partner: {
        id: charge.partner.id,
        name: charge.partner.name,
        code: charge.partner.code,
        displayName: charge.partner.displayName,
      },
      baseCharge: parseFloat(charge.baseCharge),
      isActive: charge.isActive,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    });
  }

  /**
   * Create list from Prisma models
   */
  static fromPrismaList(charges) {
    return charges.map((charge) =>
      PincodeTypeServiceChargeDTO.fromPrisma(charge),
    );
  }

  toJSON() {
    return {
      id: this.id,
      pincodeType: this.pincodeType,
      partner: this.partner,
      baseCharge: this.baseCharge,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Create Charge Request DTO
 */
class CreateChargeRequestDTO {
  constructor(data) {
    this.pincodeTypeIds = data.pincodeTypeIds;
    this.partnerIds = data.partnerIds;
    this.baseCharge = data.baseCharge;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  validate() {
    const errors = [];

    if (
      !Array.isArray(this.pincodeTypeIds) ||
      this.pincodeTypeIds.length === 0
    ) {
      errors.push("pincodeTypeIds must be a non-empty array");
    }

    if (!Array.isArray(this.partnerIds) || this.partnerIds.length === 0) {
      errors.push("partnerIds must be a non-empty array");
    }

    if (typeof this.baseCharge !== "number" || this.baseCharge <= 0) {
      errors.push("baseCharge must be a positive number");
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  toJSON() {
    return {
      pincodeTypeIds: this.pincodeTypeIds,
      partnerIds: this.partnerIds,
      baseCharge: this.baseCharge,
      isActive: this.isActive,
    };
  }
}

/**
 * Update Charge Request DTO
 */
class UpdateChargeRequestDTO {
  constructor(data) {
    this.baseCharge = data.baseCharge;
    this.isActive = data.isActive;
  }

  hasUpdates() {
    return this.baseCharge !== undefined || this.isActive !== undefined;
  }

  toJSON() {
    const result = {};
    if (this.baseCharge !== undefined) result.baseCharge = this.baseCharge;
    if (this.isActive !== undefined) result.isActive = this.isActive;
    return result;
  }
}

/**
 * Charge List Response DTO with pagination
 */
class ChargeListResponseDTO {
  constructor(data) {
    this.charges = data.charges;
    this.pagination = data.pagination;
  }

  static fromService(result) {
    return new ChargeListResponseDTO({
      charges: result.charges,
      pagination: result.pagination,
    });
  }

  toJSON() {
    return {
      charges: this.charges,
      pagination: this.pagination,
    };
  }
}

module.exports = {
  PincodeTypeServiceChargeDTO,
  CreateChargeRequestDTO,
  UpdateChargeRequestDTO,
  ChargeListResponseDTO,
};
