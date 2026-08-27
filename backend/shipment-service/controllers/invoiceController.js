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
const outletWalletContextService = require("../services/outletWalletContextService");

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
 * Resolve the billing scope a caller may read invoices for.
 *
 * These endpoints previously took `outletId`/`clientId` straight from the query
 * string and applied no caller scoping at all — the ONLY thing preventing one
 * tenant reading another's invoices was the route demanding a high permission
 * scope. Lowering that scope so outlets can see their own invoices therefore
 * has to come WITH real scoping, not instead of it.
 *
 * Returns `null` for platform roles (no restriction), or a Prisma-ready filter
 * for everyone else.
 */
async function resolveInvoiceScope(req) {
  const role = req.user?.role;
  if (role === "superadmin" || role === "admin") return null;

  const userId = req.user?.userId || req.user?.id;

  if (role === "outlet") {
    // An outlet session carries the outlet USER id; Invoice.outletId is the
    // outlet ENTITY id, so it has to be resolved before it can be compared.
    const context =
      await outletWalletContextService.resolveOutletWalletByUserId(userId);
    if (!context?.outletId) return { outletId: "__none__" };
    return { outletId: context.outletId };
  }

  if (req.user?.clientId) return { clientId: req.user.clientId };

  // Unknown role with no resolvable tenant: match nothing rather than
  // everything. Failing closed here is the whole point.
  return { outletId: "__none__" };
}

/** True when `invoice` falls inside `scope` (null scope = unrestricted). */
function invoiceInScope(invoice, scope) {
  if (!scope) return true;
  if (scope.outletId) return invoice?.outletId === scope.outletId;
  if (scope.clientId) return invoice?.clientId === scope.clientId;
  return false;
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

    // 404 rather than 403: a caller outside the scope should not be able to
    // probe which invoice ids exist.
    const scope = await resolveInvoiceScope(req);
    if (!invoiceInScope(invoice, scope)) {
      return res
        .status(404)
        .json(APIResponse.error("Invoice not found", "NOT_FOUND", null, 404));
    }

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

    // A caller-supplied outletId/clientId is only honoured for platform roles.
    // For everyone else the resolved scope overrides it outright, so passing
    // someone else's id in the query cannot widen what you can read.
    const scope = await resolveInvoiceScope(req);

    const result = await invoiceService.listInvoices({
      shipmentId,
      outletId: scope ? scope.outletId : outletId,
      clientId: scope ? scope.clientId : clientId,
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

    // Same scope gate as getInvoiceById — the PDF is the invoice, and it also
    // embeds a wallet-transaction annexure, so it must not be reachable by id
    // alone.
    const scope = await resolveInvoiceScope(req);
    if (!invoiceInScope(invoice, scope)) {
      return res
        .status(404)
        .json(APIResponse.error("Invoice not found", "NOT_FOUND", null, 404));
    }

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
