const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const APIResponse = require("../shared/lib/response");

/**
 * @swagger
 * /api/partners:
 *   get:
 *     tags: [Partners]
 *     summary: Get all active partners
 *     description: Retrieve a list of all active courier partners
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active partners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     partners:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Partner'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get("/", authMiddleware.authenticate, async (req, res, next) => {
  try {
    // TODO: Implement partner listing logic
    const partners = [
      {
        id: "partner-1",
        name: "DELHIVERY",
        code: "DELHIVERY",
        displayName: "Delhivery",
        isActive: true,
        supportsCOD: true,
        supportsReverse: true,
        maxWeight: 50.0,
        servicePincodes: ["110001", "400001", "560001"],
      },
      {
        id: "partner-2",
        name: "BLUEDART",
        code: "BLUEDART",
        displayName: "Blue Dart",
        isActive: true,
        supportsCOD: false,
        supportsReverse: true,
        maxWeight: 30.0,
        servicePincodes: ["110001", "400001", "560001"],
      },
    ];

    res.json(APIResponse.success({ partners }));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/partners/calculate:
 *   post:
 *     tags: [Rates]
 *     summary: Calculate shipping rates
 *     description: Calculate shipping rates from all available partners
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RateCalculationRequest'
 *     responses:
 *       200:
 *         description: Rate calculation results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateCalculationResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/calculate",
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const {
        fromPincode,
        toPincode,
        weight,
        serviceType,
        codAmount,
        partnerId,
      } = req.body;

      // TODO: Implement rate calculation logic
      const rates = [
        {
          partnerId: "partner-1",
          partnerName: "Delhivery",
          serviceType: serviceType || "SURFACE",
          rate: 85.5,
          codCharge: codAmount ? 15.0 : 0,
          fuelSurcharge: 8.55,
          totalAmount: codAmount ? 109.05 : 94.05,
          deliveryDays: 3,
          isServiceable: true,
        },
        {
          partnerId: "partner-2",
          partnerName: "Blue Dart",
          serviceType: serviceType || "SURFACE",
          rate: 95.0,
          codCharge: 0, // Blue Dart doesn't support COD
          fuelSurcharge: 9.5,
          totalAmount: 104.5,
          deliveryDays: 2,
          isServiceable: true,
        },
      ];

      const cheapestRate = rates.reduce((prev, current) =>
        prev.totalAmount < current.totalAmount ? prev : current,
      );

      const fastestRate = rates.reduce((prev, current) =>
        prev.deliveryDays < current.deliveryDays ? prev : current,
      );

      res.json(
        APIResponse.success({
          rates,
          cheapestRate,
          fastestRate,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/serviceability:
 *   post:
 *     tags: [Serviceability]
 *     summary: Check serviceability
 *     description: Check if partners can service a route
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceabilityRequest'
 *     responses:
 *       200:
 *         description: Serviceability check results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceabilityResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/serviceability",
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const { fromPincode, toPincode, partnerId } = req.body;

      // TODO: Implement serviceability checking logic
      const serviceability = [
        {
          partnerId: "partner-1",
          partnerName: "Delhivery",
          isServiceable: true,
          serviceTypes: ["SURFACE", "AIR"],
          deliveryDays: {
            SURFACE: 3,
            AIR: 2,
          },
        },
        {
          partnerId: "partner-2",
          partnerName: "Blue Dart",
          isServiceable: true,
          serviceTypes: ["SURFACE", "EXPRESS"],
          deliveryDays: {
            SURFACE: 2,
            EXPRESS: 1,
          },
        },
      ];

      res.json(APIResponse.success({ serviceability }));
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
