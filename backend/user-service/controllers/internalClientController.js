// Internal Client Controller - Inter-service client lookups
// Handles internal requests from other microservices to resolve client data

const { PrismaClient } = require("@prisma/client");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

const prisma = new PrismaClient();

/**
 * Get client billing/legal details by clientId
 * Called by shipment-service to snapshot billed-to details onto a tax invoice
 * at issue time. Requires X-Internal-Request header.
 *
 * NOTE: the Client model has no GSTIN field today — only `name`, `address`
 * (general business address Json), `contactEmail`, `contactPhone`,
 * `businessType`. `gst` is returned as null until such a field is added.
 *
 * GET /api/v1/internal/clients/:clientId/billing-details
 * Response: { found: boolean, clientId?: uuid, name?: string, gst?: null,
 *   address?: object, contactEmail?: string, contactPhone?: string,
 *   businessType?: string }
 */
async function getClientBillingDetails(req, res) {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res
        .status(400)
        .json(APIResponse.error("clientId parameter is required", 400));
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        address: true,
        contactEmail: true,
        contactPhone: true,
        businessType: true,
        isActive: true,
      },
    });

    if (!client) {
      logger.debug("No client found for billing details lookup", {
        clientId,
      });
      return res
        .status(200)
        .json(
          APIResponse.success({ found: false }, "No client found for this ID"),
        );
    }

    logger.debug("Client billing details resolved", { clientId: client.id });

    return res.status(200).json(
      APIResponse.success(
        {
          found: true,
          clientId: client.id,
          name: client.name,
          // Client model has no GSTIN field today; kept null for API-shape
          // parity with the outlet billing-details endpoint.
          gst: null,
          address: client.address,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
          businessType: client.businessType,
          isActive: client.isActive,
        },
        "Client billing details resolved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error resolving client billing details", {
      error: error.message,
      clientId: req.params.clientId,
    });
    return res
      .status(500)
      .json(APIResponse.error("Failed to resolve client billing details", 500));
  }
}

module.exports = {
  getClientBillingDetails,
};
