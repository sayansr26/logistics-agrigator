/* eslint-env jest */

jest.mock("../config/database", () => ({
  prisma: {
    shipment: {
      update: jest.fn(),
    },
  },
}));

jest.mock(
  "../shared/lib/logger",
  () => ({
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
  { virtual: true },
);

jest.mock("./outletWalletContextService", () => ({
  resolveOutletWalletByUserId: jest.fn(),
  resolveOutletWalletByOutletId: jest.fn(),
}));

const { prisma } = require("../config/database");
const outletWalletContextService = require("./outletWalletContextService");
const {
  resolveShipmentWalletTarget,
  getCancellationPaymentStatus,
} = require("./shipmentWalletService");

describe("shipmentWalletService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("resolveShipmentWalletTarget", () => {
    it("uses persisted walletUserId when present", async () => {
      const result = await resolveShipmentWalletTarget({
        id: "shipment-1",
        walletUserId: "+919999999999",
        userId: "user-1",
        outletId: "outlet-1",
      });

      expect(result).toEqual({
        walletUserId: "+919999999999",
        source: "shipment.walletUserId",
        persisted: false,
        isFallback: false,
      });
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it("resolves wallet user from outletId and persists it", async () => {
      outletWalletContextService.resolveOutletWalletByOutletId.mockResolvedValue(
        {
          phone: "+918888888888",
        },
      );

      const result = await resolveShipmentWalletTarget({
        id: "shipment-2",
        walletUserId: null,
        outletId: "outlet-2",
        userId: "user-2",
      });

      expect(
        outletWalletContextService.resolveOutletWalletByOutletId,
      ).toHaveBeenCalledWith("outlet-2");
      expect(prisma.shipment.update).toHaveBeenCalledWith({
        where: { id: "shipment-2" },
        data: { walletUserId: "+918888888888" },
      });
      expect(result).toEqual({
        walletUserId: "+918888888888",
        source: "user-service.outletId",
        persisted: true,
        isFallback: false,
      });
    });

    it("resolves wallet user from userId when outletId is unavailable", async () => {
      outletWalletContextService.resolveOutletWalletByOutletId.mockResolvedValue(
        null,
      );
      outletWalletContextService.resolveOutletWalletByUserId.mockResolvedValue({
        phone: "+917777777777",
      });

      const result = await resolveShipmentWalletTarget({
        id: "shipment-3",
        walletUserId: null,
        outletId: "outlet-3",
        userId: "user-3",
      });

      expect(
        outletWalletContextService.resolveOutletWalletByUserId,
      ).toHaveBeenCalledWith("user-3");
      expect(result).toEqual({
        walletUserId: "+917777777777",
        source: "user-service.userId",
        persisted: true,
        isFallback: false,
      });
    });

    it("falls back to shipment.userId when no outlet phone can be resolved", async () => {
      outletWalletContextService.resolveOutletWalletByOutletId.mockResolvedValue(
        null,
      );
      outletWalletContextService.resolveOutletWalletByUserId.mockResolvedValue(
        null,
      );

      const result = await resolveShipmentWalletTarget({
        id: "shipment-4",
        walletUserId: null,
        outletId: "outlet-4",
        userId: "user-4",
      });

      expect(result).toEqual({
        walletUserId: "user-4",
        source: "shipment.userId",
        persisted: false,
        isFallback: true,
      });
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });
  });

  describe("getCancellationPaymentStatus", () => {
    it("returns NO_REFUND for COD shipments", () => {
      expect(
        getCancellationPaymentStatus({ paymentType: "COD" }, 100, null),
      ).toBe("NO_REFUND");
    });

    it("returns REFUNDED when a prepaid refund succeeds", () => {
      expect(
        getCancellationPaymentStatus(
          { paymentType: "PREPAID" },
          100,
          "refund-tx-1",
        ),
      ).toBe("REFUNDED");
    });

    it("returns REFUND_FAILED when a prepaid refund should happen but does not complete", () => {
      expect(
        getCancellationPaymentStatus({ paymentType: "PREPAID" }, 100, null),
      ).toBe("REFUND_FAILED");
    });
  });
});
