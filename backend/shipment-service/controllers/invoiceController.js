/**
 * Invoice Controller
 *
 * Thin controller layer - all business logic lives in invoiceService /
 * invoicePdfService. Follows the controller pattern used across this
 * service (see shipmentController.js).
 */

const fs = require("fs");
const { prisma } = require("../config/database");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");
const { APIError } = require("../shared/lib/errors");
const invoiceService = require("../services/invoiceService");
const invoicePdfService = require("../services/invoicePdfService");
const shipmentLedgerService = require("../services/shipmentLedgerService");

function serializeInvoice(invoice) {
  if (!invoice) return invoice;

  // Prisma Decimals serialise as strings; convert to numbers for the API while
  // preserving null. Written out rather than using `!= null` so the lint rule
  // banning loose equality is satisfied without changing the semantics —
  // undefined must map to null here too.
  const toNumber = (value) =>
    value === null || value === undefined ? null : Number(value);

  return {
    ...invoice,
    taxableValue: toNumber(invoice.taxableValue),
    cgstRate: toNumber(invoice.cgstRate),
    cgstAmount: toNumber(invoice.cgstAmount),
    sgstRate: toNumber(invoice.sgstRate),
    sgstAmount: toNumber(invoice.sgstAmount),
    igstRate: toNumber(invoice.igstRate),
    igstAmount: toNumber(invoice.igstAmount),
    totalAmount: toNumber(invoice.totalAmount),
    chargeableWeight: toNumber(invoice.chargeableWeight),
  };
}

function errorToResponse(res, error, fallbackMessage) {
  if (error instanceof APIError) {
    return res
      .status(error.statusCode || 500)
      .json(
        APIResponse.error(
          error.message,
          error.code,
          error.details || null,
          error.statusCode || 500,
        ),
      );
  }

  logger.error(fallbackMessage, {
    service: "shipment-service",
    error: error.message,
    stack: error.stack,
  });
  return res
    .status(500)
    .json(APIResponse.error(fallbackMessage, "INTERNAL_ERROR", null, 500));
}

/**
 * POST /api/v1/invoices/shipments/:shipmentId/issue
 */
async function issueTaxInvoice(req, res) {
  try {
    const { shipmentId } = req.params;
    const userId = req.user.userId || req.user.id;

    const invoice = await invoiceService.issueTaxInvoice(
      shipmentId,
      userId,
      req.ip,
      req.get("User-Agent"),
    );

    res
      .status(200)
      .json(
        APIResponse.success(
          { invoice: serializeInvoice(invoice) },
          "Tax invoice issued successfully",
        ),
      );
  } catch (error) {
    errorToResponse(res, error, "Failed to issue tax invoice");
  }
}

/**
 * GET /api/v1/invoices/:id
 */
async function getInvoiceById(req, res) {
  try {
    const { id } = req.params;
    const invoice = await invoiceService.getInvoiceById(id);
    res
      .status(200)
      .json(
        APIResponse.success(
          { invoice: serializeInvoice(invoice) },
          "Invoice retrieved successfully",
        ),
      );
  } catch (error) {
    errorToResponse(res, error, "Failed to retrieve invoice");
  }
}

/**
 * GET /api/v1/invoices
 */
async function listInvoices(req, res) {
  try {
    const {
      shipmentId,
      outletId,
      clientId,
      dateFrom,
      dateTo,
      status,
      invoiceType,
      page,
      limit,
    } = req.query;

    const result = await invoiceService.listInvoices({
      shipmentId,
      outletId,
      clientId,
      dateFrom,
      dateTo,
      status,
      invoiceType,
      page,
      limit,
    });

    res
      .status(200)
      .json(
        APIResponse.paginated(
          { invoices: result.invoices.map(serializeInvoice) },
          result.pagination,
        ),
      );
  } catch (error) {
    errorToResponse(res, error, "Failed to list invoices");
  }
}

/**
 * POST /api/v1/invoices/notes
 * Manual trigger - same underlying function the automatic rerate hook uses.
 */
async function issueAdjustmentNote(req, res) {
  try {
    const { financialAdjustmentId } = req.body;
    const userId = req.user.userId || req.user.id;

    const note = await invoiceService.issueAdjustmentNote(
      financialAdjustmentId,
      userId,
      req.ip,
      req.get("User-Agent"),
    );

    if (!note) {
      return res
        .status(200)
        .json(
          APIResponse.success(
            { note: null },
            "No note issued - either no ISSUED tax invoice exists yet for this shipment, or the adjustment has a zero difference (nothing to correct)",
          ),
        );
    }

    res
      .status(200)
      .json(
        APIResponse.success(
          { note: serializeInvoice(note) },
          "Adjustment note issued successfully",
        ),
      );
  } catch (error) {
    errorToResponse(res, error, "Failed to issue adjustment note");
  }
}

/**
 * GET /api/v1/invoices/:id/pdf
 * Generates the PDF if missing, then streams it.
 */
async function downloadInvoicePdf(req, res) {
  try {
    const { id } = req.params;
    const invoice = await invoiceService.getInvoiceById(id);

    // The PDF carries a wallet-transaction annexure, and that ledger keeps
    // moving after the invoice is issued (a re-rate adds a reversal and a
    // re-charge). Attach the current ledger, and treat a cached PDF that
    // predates the newest movement as stale so it gets rebuilt.
    const ledger = invoice.shipmentId
      ? await shipmentLedgerService.buildShipmentLedger(invoice.shipmentId)
      : null;
    invoice.walletLedger = ledger;

    const latestMovement = (ledger?.transactions || [])
      .map((t) => (t.occurredAt ? new Date(t.occurredAt).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);

    let filePath = invoice.pdfUrl;
    let fileExists = false;

    if (filePath) {
      try {
        const stat = await fs.promises.stat(filePath);
        fileExists = stat.mtimeMs >= latestMovement;
      } catch (_error) {
        fileExists = false;
      }
    }

    if (!fileExists) {
      const generated = await invoicePdfService.generateInvoicePdf(invoice);
      filePath = generated.filePath;

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl: filePath },
      });
    }

    const safeNumber = invoice.invoiceNumber.replace(/[/\\]/g, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeNumber}.pdf"`,
    );

    const stream = fs.createReadStream(filePath);
    stream.on("error", (streamError) => {
      logger.error("Error streaming invoice PDF", {
        service: "shipment-service",
        invoiceId: id,
        error: streamError.message,
      });
      if (!res.headersSent) {
        res
          .status(500)
          .json(
            APIResponse.error(
              "Failed to stream invoice PDF",
              "INTERNAL_ERROR",
              null,
              500,
            ),
          );
      }
    });
    stream.pipe(res);
  } catch (error) {
    errorToResponse(res, error, "Failed to download invoice PDF");
  }
}

module.exports = {
  issueTaxInvoice,
  getInvoiceById,
  listInvoices,
  issueAdjustmentNote,
  downloadInvoicePdf,
};
