// Payout Controller - Affiliate payout management
// Handles payout requests, approvals, and history

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { WalletError } = require("../middleware/errorHandler");
const axios = require("axios");

const prisma = new PrismaClient();

/**
 * Request payout for affiliate commissions
 * Permission: affiliate:create:own (payout request)
 */
async function requestPayout(req, res) {
  try {
    const affiliateId = req.user.id; // Current affiliate user
    const { amount, metadata } = req.body;

    // Verify user is affiliate
    if (req.user.role !== "affiliate") {
      throw new WalletError(
        "Only affiliates can request payouts",
        "AFFILIATE_ONLY",
        403,
      );
    }

    // Validate amount
    if (!amount || amount <= 0) {
      throw new WalletError(
        "Payout amount must be greater than 0",
        "INVALID_AMOUNT",
        400,
      );
    }

    // Get affiliate's wallet
    let wallet = await prisma.wallet.findUnique({
      where: { userId: affiliateId },
    });

    if (!wallet) {
      // Auto-create wallet if it doesn't exist
      wallet = await prisma.wallet.create({
        data: {
          userId: affiliateId,
          balance: 0,
          status: "ACTIVE",
        },
      });

      logger.info("Wallet auto-created for affiliate", {
        affiliateId,
        walletId: wallet.id,
        service: "wallet-service",
      });
    }

    // Get approved commission balance from user-service
    const userServiceUrl =
      process.env.USER_SERVICE_URL || "http://user-service:3003";

    let approvedBalance = 0;
    try {
      const response = await axios.get(
        `${userServiceUrl}/api/v1/affiliate/stats`,
        {
          headers: {
            Authorization: req.get("Authorization"),
          },
        },
      );

      approvedBalance = response.data.data.stats.approvedAmount || 0;
    } catch (apiError) {
      logger.error("Failed to fetch affiliate approved balance", {
        error: apiError.message,
        affiliateId,
        service: "wallet-service",
      });
    }

    // Check if affiliate has sufficient approved commissions
    if (amount > approvedBalance) {
      throw new WalletError(
        `Insufficient approved commission balance. Available: ${approvedBalance}, Requested: ${amount}`,
        "INSUFFICIENT_APPROVED_BALANCE",
        400,
      );
    }

    // Create payout transaction record
    const transaction = await prisma.$transaction(async (tx) => {
      const payoutTransaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT", // Credit to wallet when approved
          amount,
          description: `Affiliate payout request - ${amount}`,
          reference: `PAYOUT_REQUEST_${Date.now()}`,
          status: "PENDING",
          metadata: {
            type: "AFFILIATE_PAYOUT_REQUEST",
            affiliateId,
            requestedAmount: amount,
            approvedBalance,
            ...metadata,
          },
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          walletId: wallet.id,
          userId: affiliateId,
          action: "REQUEST_PAYOUT",
          resource: "Transaction",
          resourceId: payoutTransaction.id,
          details: {
            amount,
            approvedBalance,
            transactionId: payoutTransaction.id,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return payoutTransaction;
    });

    logger.info("Payout request created successfully", {
      transactionId: transaction.id,
      affiliateId,
      amount,
      service: "wallet-service",
    });

    res.status(201).json(
      APIResponse.success({
        payoutRequest: {
          id: transaction.id,
          amount: transaction.amount,
          status: transaction.status,
          reference: transaction.reference,
          createdAt: transaction.createdAt,
        },
        message:
          "Payout request submitted successfully. Awaiting admin approval.",
      }),
    );
  } catch (error) {
    logger.error("Request payout error", {
      error: error.message,
      userId: req.user.id,
      requestBody: req.body,
      service: "wallet-service",
    });
    throw error;
  }
}

/**
 * List all payout requests (admin only)
 * Permission: wallet:read:all
 */
async function listPayoutRequests(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "PENDING",
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause for payout requests
    const where = {
      type: "CREDIT",
      metadata: {
        path: ["type"],
        equals: "AFFILIATE_PAYOUT_REQUEST",
      },
    };

    if (status) {
      where.status = status;
    }

    const [payoutRequests, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          wallet: {
            select: {
              id: true,
              userId: true,
              balance: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    const hasMore = skip + payoutRequests.length < total;
    const totalPages = Math.ceil(total / limit);

    res.json(
      APIResponse.success({
        payoutRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore,
          hasPrevious: page > 1,
        },
        filters: {
          status,
        },
      }),
    );
  } catch (error) {
    logger.error("List payout requests error", {
      error: error.message,
      userId: req.user.id,
      query: req.query,
      service: "wallet-service",
    });
    throw error;
  }
}

/**
 * Approve payout and credit affiliate wallet
 * Permission: wallet:manage:all (admin only)
 */
async function approvePayout(req, res) {
  try {
    const { payoutId } = req.params;
    const { notes } = req.body;

    // Get payout request
    const payoutRequest = await prisma.transaction.findUnique({
      where: { id: payoutId },
      include: {
        wallet: true,
      },
    });

    if (!payoutRequest) {
      throw new WalletError(
        `Payout request with ID '${payoutId}' not found`,
        "PAYOUT_NOT_FOUND",
        404,
      );
    }

    if (payoutRequest.status !== "PENDING") {
      throw new WalletError(
        `Payout request is not in PENDING status. Current status: ${payoutRequest.status}`,
        "INVALID_PAYOUT_STATUS",
        400,
      );
    }

    const affiliateId = payoutRequest.wallet.userId;
    const amount = parseFloat(payoutRequest.amount);

    // Execute payout approval
    const result = await prisma.$transaction(async (tx) => {
      // Update payout request status to COMPLETED
      const approvedPayout = await tx.transaction.update({
        where: { id: payoutId },
        data: {
          status: "COMPLETED",
          metadata: {
            ...payoutRequest.metadata,
            approvedAt: new Date().toISOString(),
            approvedBy: req.user.id,
            notes,
          },
        },
      });

      // Credit affiliate wallet
      const updatedWallet = await tx.wallet.update({
        where: { id: payoutRequest.walletId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          walletId: payoutRequest.walletId,
          userId: req.user.id,
          action: "APPROVE_PAYOUT",
          resource: "Transaction",
          resourceId: payoutId,
          details: {
            affiliateId,
            amount,
            payoutId,
            newBalance: updatedWallet.balance,
            approvedBy: req.user.id,
            notes,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return { approvedPayout, updatedWallet };
    });

    // Update commissions status in user-service to PAID
    const userServiceUrl =
      process.env.USER_SERVICE_URL || "http://user-service:3003";

    try {
      await axios.post(
        `${userServiceUrl}/api/v1/admin/affiliates/${affiliateId}/mark-commissions-paid`,
        {
          amount,
          payoutId,
        },
        {
          headers: {
            Authorization: req.get("Authorization"),
          },
        },
      );
    } catch (apiError) {
      logger.error("Failed to update commissions status in user-service", {
        error: apiError.message,
        affiliateId,
        payoutId,
        service: "wallet-service",
      });
      // Don't throw - payout was successful, just log the error
    }

    logger.info("Payout approved and wallet credited", {
      payoutId,
      affiliateId,
      amount,
      newBalance: result.updatedWallet.balance,
      approvedBy: req.user.id,
      service: "wallet-service",
    });

    res.json(
      APIResponse.success({
        payout: {
          id: result.approvedPayout.id,
          amount: result.approvedPayout.amount,
          status: result.approvedPayout.status,
          approvedAt: new Date().toISOString(),
        },
        wallet: {
          id: result.updatedWallet.id,
          balance: result.updatedWallet.balance,
        },
        message: "Payout approved and wallet credited successfully",
      }),
    );
  } catch (error) {
    logger.error("Approve payout error", {
      error: error.message,
      payoutId: req.params.payoutId,
      userId: req.user.id,
      service: "wallet-service",
    });
    throw error;
  }
}

/**
 * Reject payout request
 * Permission: wallet:manage:all (admin only)
 */
async function rejectPayout(req, res) {
  try {
    const { payoutId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new WalletError(
        "Rejection reason is required",
        "REASON_REQUIRED",
        400,
      );
    }

    // Get payout request
    const payoutRequest = await prisma.transaction.findUnique({
      where: { id: payoutId },
      include: {
        wallet: true,
      },
    });

    if (!payoutRequest) {
      throw new WalletError(
        `Payout request with ID '${payoutId}' not found`,
        "PAYOUT_NOT_FOUND",
        404,
      );
    }

    if (payoutRequest.status !== "PENDING") {
      throw new WalletError(
        `Payout request is not in PENDING status. Current status: ${payoutRequest.status}`,
        "INVALID_PAYOUT_STATUS",
        400,
      );
    }

    const affiliateId = payoutRequest.wallet.userId;

    // Reject payout
    const result = await prisma.$transaction(async (tx) => {
      const rejectedPayout = await tx.transaction.update({
        where: { id: payoutId },
        data: {
          status: "CANCELLED",
          metadata: {
            ...payoutRequest.metadata,
            rejectedAt: new Date().toISOString(),
            rejectedBy: req.user.id,
            rejectionReason: reason,
          },
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          walletId: payoutRequest.walletId,
          userId: req.user.id,
          action: "REJECT_PAYOUT",
          resource: "Transaction",
          resourceId: payoutId,
          details: {
            affiliateId,
            amount: payoutRequest.amount,
            payoutId,
            rejectedBy: req.user.id,
            reason,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      });

      return rejectedPayout;
    });

    logger.warn("Payout rejected", {
      payoutId,
      affiliateId,
      amount: result.amount,
      reason,
      rejectedBy: req.user.id,
      service: "wallet-service",
    });

    res.json(
      APIResponse.success({
        payout: {
          id: result.id,
          amount: result.amount,
          status: result.status,
          rejectedAt: new Date().toISOString(),
          reason,
        },
        message: "Payout request rejected",
      }),
    );
  } catch (error) {
    logger.error("Reject payout error", {
      error: error.message,
      payoutId: req.params.payoutId,
      userId: req.user.id,
      service: "wallet-service",
    });
    throw error;
  }
}

/**
 * Get payout history for affiliate
 * Permission: affiliate:read:own or wallet:read:all (admin)
 */
async function getPayoutHistory(req, res) {
  try {
    const { affiliateId } = req.params;

    // Check permission: affiliates can only view own history
    if (
      req.user.role !== "superadmin" &&
      req.user.role !== "admin" &&
      req.user.id !== affiliateId
    ) {
      throw new WalletError(
        "Access denied. You can only view your own payout history.",
        "PAYOUT_ACCESS_DENIED",
        403,
      );
    }

    // Get affiliate's wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId: affiliateId },
    });

    if (!wallet) {
      return res.json(
        APIResponse.success({
          payoutHistory: [],
          count: 0,
          message: "No wallet found for this affiliate",
        }),
      );
    }

    // Get all payout transactions
    const payoutHistory = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        type: "CREDIT",
        metadata: {
          path: ["type"],
          equals: "AFFILIATE_PAYOUT_REQUEST",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      APIResponse.success({
        payoutHistory,
        count: payoutHistory.length,
        totalPaid: payoutHistory
          .filter((p) => p.status === "COMPLETED")
          .reduce((sum, p) => sum + parseFloat(p.amount), 0),
        totalPending: payoutHistory
          .filter((p) => p.status === "PENDING")
          .reduce((sum, p) => sum + parseFloat(p.amount), 0),
      }),
    );
  } catch (error) {
    logger.error("Get payout history error", {
      error: error.message,
      affiliateId: req.params.affiliateId,
      userId: req.user.id,
      service: "wallet-service",
    });
    throw error;
  }
}

module.exports = {
  requestPayout,
  listPayoutRequests,
  approvePayout,
  rejectPayout,
  getPayoutHistory,
};
