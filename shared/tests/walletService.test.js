/* eslint-env jest */

const {
  WalletServiceClient,
  WalletServiceError,
  getWalletServiceClient,
} = require("../lib/walletService");
const {
  requireSufficientBalance,
  reserveWalletAmount,
  confirmWalletReservation,
  cancelWalletReservation,
  debitWalletAmount,
  creditWalletAmount,
} = require("../lib/walletMiddleware");

// Mock fetch for testing
global.fetch = jest.fn();

describe("Wallet Service Integration Tests", () => {
  let walletClient;

  beforeEach(() => {
    // Reset fetch mock
    fetch.mockReset();

    // Create new client instance for each test
    walletClient = new WalletServiceClient({
      baseURL: "http://localhost:8006",
      apiKey: "test-api-key",
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
    });
  });

  describe("WalletServiceClient", () => {
    describe("getBalance", () => {
      it("should successfully get user balance", async () => {
        const mockResponse = {
          balance: 1000,
          availableBalance: 800,
          reservedBalance: 200,
          lastUpdated: "2024-01-01T00:00:00Z",
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await walletClient.getBalance("user123", "INR");

        expect(result.success).toBe(true);
        expect(result.data.userId).toBe("user123");
        expect(result.data.currency).toBe("INR");
        expect(result.data.balance).toBe(1000);
        expect(result.data.availableBalance).toBe(800);

        expect(fetch).toHaveBeenCalledWith(
          "http://localhost:8006/api/v1/wallet/balance/user123",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer test-api-key",
              "X-Service": "logistics-platform",
              "X-Currency": "INR",
            }),
            timeout: 5000,
            signal: expect.any(AbortSignal),
          }),
        );
      });

      it("should throw error for missing user ID", async () => {
        await expect(walletClient.getBalance("")).rejects.toThrow(
          WalletServiceError,
        );
        await expect(walletClient.getBalance(null)).rejects.toThrow(
          WalletServiceError,
        );
      });

      it("should handle API errors", async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "User not found",
        });

        await expect(walletClient.getBalance("user123")).rejects.toThrow(
          WalletServiceError,
        );
      });
    });

    describe("reserveAmount", () => {
      it("should successfully reserve amount", async () => {
        const mockResponse = {
          reservationId: "res123",
          expiresAt: "2024-01-01T01:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await walletClient.reserveAmount(
          "user123",
          500,
          "INR",
          "order123",
        );

        expect(result.success).toBe(true);
        expect(result.data.reservationId).toBe("res123");
        expect(result.data.userId).toBe("user123");
        expect(result.data.amount).toBe(500);
        expect(result.data.status).toBe("reserved");

        expect(fetch).toHaveBeenCalledWith(
          "http://localhost:8006/api/v1/wallet/reserve",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer test-api-key",
              "X-Service": "logistics-platform",
            }),
            body: expect.stringMatching(
              /"userId":"user123".*"amount":500.*"currency":"INR".*"reference":"order123".*"metadata":\{.*"service":"logistics-platform"/,
            ),
            timeout: 5000,
            signal: expect.any(AbortSignal),
          }),
        );
      });

      it("should validate required parameters", async () => {
        await expect(
          walletClient.reserveAmount("", 500, "INR", "ref"),
        ).rejects.toThrow(WalletServiceError);
        await expect(
          walletClient.reserveAmount("user123", 0, "INR", "ref"),
        ).rejects.toThrow(WalletServiceError);
        await expect(
          walletClient.reserveAmount("user123", -100, "INR", "ref"),
        ).rejects.toThrow(WalletServiceError);
        await expect(
          walletClient.reserveAmount("user123", 500, "INR", ""),
        ).rejects.toThrow(WalletServiceError);
      });
    });

    describe("debitAmount", () => {
      it("should successfully debit amount", async () => {
        const mockResponse = {
          transactionId: "txn123",
          balanceAfter: 500,
          createdAt: "2024-01-01T00:00:00Z",
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await walletClient.debitAmount(
          "user123",
          500,
          "INR",
          "order123",
        );

        expect(result.success).toBe(true);
        expect(result.data.transactionId).toBe("txn123");
        expect(result.data.status).toBe("completed");
        expect(result.data.balanceAfter).toBe(500);
      });
    });

    describe("creditAmount", () => {
      it("should successfully credit amount", async () => {
        const mockResponse = {
          transactionId: "txn456",
          balanceAfter: 1500,
          createdAt: "2024-01-01T00:00:00Z",
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await walletClient.creditAmount(
          "user123",
          500,
          "INR",
          "refund123",
        );

        expect(result.success).toBe(true);
        expect(result.data.transactionId).toBe("txn456");
        expect(result.data.balanceAfter).toBe(1500);
      });
    });

    describe("confirmReservation", () => {
      it("should successfully confirm reservation", async () => {
        const mockResponse = {
          transactionId: "txn789",
          confirmedAt: "2024-01-01T00:00:00Z",
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await walletClient.confirmReservation("res123");

        expect(result.success).toBe(true);
        expect(result.data.transactionId).toBe("txn789");
        expect(result.data.status).toBe("confirmed");
      });
    });

    describe("cancelReservation", () => {
      it("should successfully cancel reservation", async () => {
        const mockResponse = {
          cancelledAt: "2024-01-01T00:00:00Z",
        };

        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await walletClient.cancelReservation("res123");

        expect(result.success).toBe(true);
        expect(result.data.status).toBe("cancelled");
      });
    });

    describe("retry logic", () => {
      it("should retry on network errors", async () => {
        // Create a client with retry settings
        const retryClient = new WalletServiceClient({
          baseURL: "http://localhost:8006",
          apiKey: "test-api-key",
          timeout: 5000,
          retryAttempts: 3,
          retryDelay: 10, // Short delay for testing
        });

        // First two calls fail, third succeeds
        fetch
          .mockRejectedValueOnce(new Error("Network error"))
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ balance: 1000, availableBalance: 1000 }),
          });

        const result = await retryClient.getBalance("user123");

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(3);
      });

      it("should not retry on 4xx errors", async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => "Invalid API key",
        });

        await expect(walletClient.getBalance("user123")).rejects.toThrow(
          WalletServiceError,
        );
        expect(fetch).toHaveBeenCalledTimes(1);
      });
    });

    describe("timeout handling", () => {
      it("should timeout after specified duration", async () => {
        const client = new WalletServiceClient({
          baseURL: "http://localhost:8006",
          apiKey: "test-api-key",
          timeout: 100,
          retryAttempts: 1,
        });

        fetch.mockImplementationOnce(
          () =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                const abortError = new Error("The operation was aborted");
                abortError.name = "AbortError";
                reject(abortError);
              }, 150);
            }),
        );

        await expect(client.getBalance("user123")).rejects.toThrow(
          WalletServiceError,
        );
      });
    });

    describe("healthCheck", () => {
      it("should return healthy status", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: "healthy", version: "1.0.0" }),
        });

        const result = await walletClient.healthCheck();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe("healthy");
      });

      it("should handle service unavailable", async () => {
        fetch.mockRejectedValueOnce(new Error("Connection refused"));

        const result = await walletClient.healthCheck();

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("Wallet service unavailable");
      });
    });
  });

  describe("Wallet Middleware", () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        user: { id: "user123" },
        path: "/api/orders",
        ip: "127.0.0.1",
        get: jest.fn().mockReturnValue("test-agent"),
        id: "req123",
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    describe("requireSufficientBalance", () => {
      it("should pass when user has sufficient balance", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            balance: 1000,
            availableBalance: 800,
            reservedBalance: 200,
          }),
        });

        const middleware = requireSufficientBalance(500);
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.walletInfo).toBeDefined();
        expect(req.walletInfo.availableBalance).toBe(800);
        expect(req.walletInfo.checkedAmount).toBe(500);
      });

      it("should reject when user has insufficient balance", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            balance: 1000,
            availableBalance: 300,
            reservedBalance: 700,
          }),
        });

        const middleware = requireSufficientBalance(500);
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(402);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "error",
            error: expect.objectContaining({
              code: "INSUFFICIENT_BALANCE",
            }),
          }),
        );
        expect(next).not.toHaveBeenCalled();
      });

      it("should handle dynamic amount calculation", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            balance: 1000,
            availableBalance: 800,
          }),
        });

        req.body = { orderTotal: 600 };
        const middleware = requireSufficientBalance(
          (req) => req.body.orderTotal,
        );
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.walletInfo.checkedAmount).toBe(600);
      });

      it("should require authentication", async () => {
        req.user = null;

        const middleware = requireSufficientBalance(500);
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe("reserveWalletAmount", () => {
      it("should successfully reserve amount", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            reservationId: "res123",
            expiresAt: "2024-01-01T01:00:00Z",
            createdAt: "2024-01-01T00:00:00Z",
          }),
        });

        const middleware = reserveWalletAmount(
          500,
          "INR",
          (req) => `order-${req.user.id}`,
        );
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.walletReservation).toBeDefined();
        expect(req.walletReservation.reservationId).toBe("res123");
        expect(req.walletReservation.amount).toBe(500);
      });

      it("should handle reservation failure", async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 402,
          statusText: "Payment Required",
          text: async () => "Insufficient balance",
        });

        const middleware = reserveWalletAmount(500);
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(402);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe("Utility Functions", () => {
    describe("confirmWalletReservation", () => {
      it("should confirm reservation successfully", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transactionId: "txn123",
            confirmedAt: "2024-01-01T00:00:00Z",
          }),
        });

        const result = await confirmWalletReservation("res123", {
          orderId: "order123",
        });

        expect(result.success).toBe(true);
        expect(result.data.transactionId).toBe("txn123");
      });
    });

    describe("cancelWalletReservation", () => {
      it("should cancel reservation successfully", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            cancelledAt: "2024-01-01T00:00:00Z",
          }),
        });

        const result = await cancelWalletReservation("res123", {
          reason: "order_cancelled",
        });

        expect(result.success).toBe(true);
        expect(result.data.status).toBe("cancelled");
      });
    });

    describe("debitWalletAmount", () => {
      it("should process debit successfully", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transactionId: "txn456",
            balanceAfter: 500,
            createdAt: "2024-01-01T00:00:00Z",
          }),
        });

        const result = await debitWalletAmount(
          "user123",
          500,
          "INR",
          "order123",
        );

        expect(result.success).toBe(true);
        expect(result.data.transactionId).toBe("txn456");
      });
    });

    describe("creditWalletAmount", () => {
      it("should process credit successfully", async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            transactionId: "txn789",
            balanceAfter: 1500,
            createdAt: "2024-01-01T00:00:00Z",
          }),
        });

        const result = await creditWalletAmount(
          "user123",
          500,
          "INR",
          "refund123",
        );

        expect(result.success).toBe(true);
        expect(result.data.transactionId).toBe("txn789");
      });
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      const client1 = getWalletServiceClient();
      const client2 = getWalletServiceClient();

      expect(client1).toBe(client2);
    });
  });

  describe("Error Handling", () => {
    it("should create WalletServiceError with correct properties", () => {
      const error = new WalletServiceError(
        "Test error",
        400,
        "Additional details",
      );

      expect(error.name).toBe("WalletServiceError");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.details).toBe("Additional details");
      expect(error.timestamp).toBeDefined();
    });
  });
});

describe("Integration Scenarios", () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  describe("Complete Order Flow", () => {
    it("should handle reserve -> confirm flow", async () => {
      const client = new WalletServiceClient({
        baseURL: "http://localhost:8006",
        apiKey: "test-key",
      });

      // Mock balance check
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: 1000, availableBalance: 1000 }),
      });

      // Mock reservation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reservationId: "res123",
          expiresAt: "2024-01-01T01:00:00Z",
        }),
      });

      // Mock confirmation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactionId: "txn123",
          confirmedAt: "2024-01-01T00:00:00Z",
        }),
      });

      // Execute flow
      const balance = await client.getBalance("user123");
      expect(balance.success).toBe(true);

      const reservation = await client.reserveAmount(
        "user123",
        500,
        "INR",
        "order123",
      );
      expect(reservation.success).toBe(true);

      const confirmation = await client.confirmReservation("res123");
      expect(confirmation.success).toBe(true);

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("should handle reserve -> cancel flow", async () => {
      const client = new WalletServiceClient({
        baseURL: "http://localhost:8006",
        apiKey: "test-key",
      });

      // Mock reservation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reservationId: "res123",
          expiresAt: "2024-01-01T01:00:00Z",
        }),
      });

      // Mock cancellation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cancelledAt: "2024-01-01T00:00:00Z",
        }),
      });

      const reservation = await client.reserveAmount(
        "user123",
        500,
        "INR",
        "order123",
      );
      expect(reservation.success).toBe(true);

      const cancellation = await client.cancelReservation("res123");
      expect(cancellation.success).toBe(true);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
