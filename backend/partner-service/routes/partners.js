const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../shared/lib/auth");
const APIResponse = require("../shared/lib/response");
const partnerController = require("../controllers/partnerController");
const { validateBody } = require("../middleware/validate");
const { partnerSchema } = require("../validation/partnerSchema");
const {
  partnerManagementLimiter,
  rateCalculationLimiter,
  serviceabilityLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * /api/partners:
 *   get:
 *     tags: [Partners]
 *     summary: Get all active partners
 *     description: Retrieve a list of all active courier partners
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: supportsCOD
 *         schema:
 *           type: boolean
 *         description: Filter by COD support
 *       - in: query
 *         name: supportsReverse
 *         schema:
 *           type: boolean
 *         description: Filter by reverse logistics support
 *     responses:
 *       200:
 *         description: List of partners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     partners:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Partner'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  async (req, res, next) => {
    try {
      const {
        isActive,
        supportsCOD,
        supportsReverse,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const filters = {
        ...(typeof isActive === "string" && { isActive: isActive === "true" }),
        ...(typeof supportsCOD === "string" && {
          supportsCOD: supportsCOD === "true",
        }),
        ...(typeof supportsReverse === "string" && {
          supportsReverse: supportsReverse === "true",
        }),
        search,
        page: page || 1,
        limit: limit || 10,
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "desc",
      };

      const result = await partnerController.getAllPartners(filters);
      res.json(APIResponse.success(result)); // Returns { partners, pagination }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/{id}:
 *   get:
 *     tags: [Partners]
 *     summary: Get partner by ID
 *     description: Retrieve a specific partner by their ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: Partner details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  "/:id",
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "all"),
  async (req, res, next) => {
    try {
      const partner = await partnerController.getPartnerById(req.params.id);
      res.json(APIResponse.success({ partner }));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners:
 *   post:
 *     tags: [Partners]
 *     summary: Create a new partner
 *     description: Create a new courier partner
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePartnerRequest'
 *     responses:
 *       201:
 *         description: Created partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  "/",
  partnerManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "create", "all"),
  validateBody(partnerSchema.create),
  async (req, res, next) => {
    try {
      const partner = await partnerController.createPartner(req.body, req);
      res.status(201).json(APIResponse.success({ partner }));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/{id}:
 *   put:
 *     tags: [Partners]
 *     summary: Update a partner
 *     description: Update an existing courier partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePartnerRequest'
 *     responses:
 *       200:
 *         description: Updated partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartnerResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put(
  "/:id",
  partnerManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "update", "all"),
  validateBody(partnerSchema.update),
  async (req, res, next) => {
    try {
      const partner = await partnerController.updatePartner(
        req.params.id,
        req.body,
        req,
      );
      res.json(APIResponse.success({ partner }));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/{id}:
 *   delete:
 *     tags: [Partners]
 *     summary: Delete a partner
 *     description: Delete an existing courier partner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Partner ID
 *     responses:
 *       200:
 *         description: Partner deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete(
  "/:id",
  partnerManagementLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "delete", "all"),
  async (req, res, next) => {
    try {
      await partnerController.deletePartner(req.params.id, req);
      res.json(
        APIResponse.success({ message: "Partner deleted successfully" }),
      );
    } catch (error) {
      next(error);
    }
  },
);

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
  rateCalculationLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "own"),
  async (req, res, next) => {
    try {
      // Pass user context for badge-based discount resolution
      const userContext = req.user
        ? { userId: req.user.userId || req.user.id, role: req.user.role }
        : null;

      const result = await partnerController.calculateRates(
        req.body,
        userContext,
      );

      // result from the new quote engine has { rates, cheapestRate, fastestRate, summary }
      const rates = result.rates || result;

      let cheapestRate = result.cheapestRate;
      let fastestRate = result.fastestRate;

      // Fallback for legacy format (array of rates)
      if (!cheapestRate && Array.isArray(rates) && rates.length > 0) {
        cheapestRate = rates.reduce((prev, current) =>
          (prev.totalAmount || prev.totalRate || 0) <
          (current.totalAmount || current.totalRate || 0)
            ? prev
            : current,
        );
        fastestRate = rates.reduce((prev, current) =>
          (prev.deliveryDays || prev.estimatedDays || 999) <
          (current.deliveryDays || current.estimatedDays || 999)
            ? prev
            : current,
        );
      }

      res.json(
        APIResponse.success({
          rates,
          cheapestRate,
          fastestRate,
          summary: result.summary,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/partners/calculate-with-discounts:
 *   post:
 *     tags: [Rates]
 *     summary: Calculate shipping rates with discount application
 *     description: Calculate shipping rates from all available partners with applicable discounts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromPincode
 *               - toPincode
 *               - weight
 *             properties:
 *               fromPincode:
 *                 type: string
 *                 description: Origin pincode
 *                 example: "110001"
 *               toPincode:
 *                 type: string
 *                 description: Destination pincode
 *                 example: "400001"
 *               weight:
 *                 type: number
 *                 format: float
 *                 description: Package weight in kg
 *                 example: 2.5
 *               serviceType:
 *                 type: string
 *                 description: Service type
 *                 example: "express"
 *               codAmount:
 *                 type: number
 *                 format: float
 *                 description: COD amount if applicable
 *                 example: 1500.0
 *               partnerId:
 *                 type: string
 *                 description: Specific partner ID (optional)
 *                 example: "PARTNER_123"
 *               dimensions:
 *                 type: object
 *                 properties:
 *                   length:
 *                     type: number
 *                     example: 20
 *                   width:
 *                     type: number
 *                     example: 15
 *                   height:
 *                     type: number
 *                     example: 10
 *               discountParams:
 *                 type: object
 *                 description: Discount calculation parameters
 *                 properties:
 *                   customerType:
 *                     type: string
 *                     enum: [NEW, PREMIUM, REGULAR, VIP]
 *                     description: Customer type for discount eligibility
 *                     example: "PREMIUM"
 *                   applicableOn:
 *                     type: string
 *                     enum: [PACKAGE, CUSTOMER_CHARGE, TOTAL, SHIPPING, COD]
 *                     description: What the discount applies to
 *                     example: "TOTAL"
 *                   zoneId:
 *                     type: integer
 *                     description: Zone ID for location-based discounts
 *                     example: 5
 *                   conditions:
 *                     type: object
 *                     description: Additional discount conditions
 *                     properties:
 *                       minimumOrderValue:
 *                         type: number
 *                         example: 500.0
 *                       isFirstOrder:
 *                         type: boolean
 *                         example: true
 *     responses:
 *       200:
 *         description: Rate calculation results with discounts applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Rates calculated successfully with discounts"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partnerId:
 *                             type: string
 *                             example: "PARTNER_123"
 *                           partnerName:
 *                             type: string
 *                             example: "Express Logistics"
 *                           serviceType:
 *                             type: string
 *                             example: "express"
 *                           rate:
 *                             type: number
 *                             format: float
 *                             description: Base rate
 *                             example: 150.0
 *                           codCharge:
 *                             type: number
 *                             format: float
 *                             example: 30.0
 *                           fuelSurcharge:
 *                             type: number
 *                             format: float
 *                             example: 15.0
 *                           originalAmount:
 *                             type: number
 *                             format: float
 *                             description: Total amount before discount
 *                             example: 195.0
 *                           discountAmount:
 *                             type: number
 *                             format: float
 *                             description: Total discount applied
 *                             example: 29.25
 *                           finalAmount:
 *                             type: number
 *                             format: float
 *                             description: Final amount after discount
 *                             example: 165.75
 *                           savings:
 *                             type: number
 *                             format: float
 *                             description: Amount saved
 *                             example: 29.25
 *                           discountPercentage:
 *                             type: string
 *                             description: Discount percentage
 *                             example: "15.00"
 *                           appliedDiscounts:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 discountId:
 *                                   type: string
 *                                   example: "DISC_001"
 *                                 discountName:
 *                                   type: string
 *                                   example: "Premium Customer Discount"
 *                                 discountType:
 *                                   type: string
 *                                   example: "PERCENTAGE"
 *                                 discountValue:
 *                                   type: number
 *                                   example: 15.0
 *                                 calculatedDiscount:
 *                                   type: number
 *                                   example: 29.25
 *                           deliveryDays:
 *                             type: integer
 *                             example: 2
 *                           isServiceable:
 *                             type: boolean
 *                             example: true
 *                     cheapestRate:
 *                       type: object
 *                       description: Rate with lowest final amount
 *                     fastestRate:
 *                       type: object
 *                       description: Rate with fastest delivery
 *                     bestValueRate:
 *                       type: object
 *                       description: Rate with best value (considering price and speed)
 *                     totalSavings:
 *                       type: number
 *                       format: float
 *                       description: Total savings across all rates
 *                       example: 125.50
 *       400:
 *         description: Bad request - Invalid parameters
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
 *       500:
 *         description: Internal server error
 */
router.post(
  "/calculate-with-discounts",
  rateCalculationLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "own"),
  async (req, res, next) => {
    try {
      const { discountParams, ...rateParams } = req.body;

      // Calculate rates with discounts
      const rates = await partnerController.calculateRatesWithDiscounts(
        rateParams,
        discountParams || {},
      );

      if (!rates || rates.length === 0) {
        return res.json(
          APIResponse.success({
            rates: [],
            message: "No rates available for the given parameters",
          }),
        );
      }

      // Find best rates (already sorted by final amount)
      const cheapestRate = rates[0]; // First item after sorting by final amount

      const fastestRate = rates.reduce((prev, current) =>
        (prev.deliveryDays || 999) < (current.deliveryDays || 999)
          ? prev
          : current,
      );

      // Best value rate: balance between price and speed
      const bestValueRate = rates.reduce((prev, current) => {
        const prevScore =
          (prev.finalAmount || 0) + (prev.deliveryDays || 1) * 10;
        const currentScore =
          (current.finalAmount || 0) + (current.deliveryDays || 1) * 10;
        return prevScore < currentScore ? prev : current;
      });

      // Calculate total savings
      const totalSavings = rates.reduce(
        (sum, rate) => sum + (rate.savings || 0),
        0,
      );

      res.json(
        APIResponse.success(
          {
            rates,
            cheapestRate,
            fastestRate,
            bestValueRate,
            totalSavings: parseFloat(totalSavings.toFixed(2)),
            discountApplied: rates.some(
              (rate) => (rate.discountAmount || 0) > 0,
            ),
            rateCount: rates.length,
          },
          "Rates calculated successfully with discounts",
        ),
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
  serviceabilityLimiter,
  authMiddleware.authenticate,
  authMiddleware.requirePermission("partner", "read", "own"),
  async (req, res, next) => {
    try {
      const serviceability = await partnerController.checkServiceability(
        req.body,
      );
      res.json(APIResponse.success({ serviceability }));
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
