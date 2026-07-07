/**
 * COD Controller
 *
 * HTTP surface for COD shipment management, collections, reconciliation and reports.
 * Business logic delegated to codService / reconciliationService / codReportService.
 */

const codService = require("../services/codService");
const reconciliationService = require("../services/reconciliationService");
const reportService = require("../services/codReportService");
const { parseCsvCollections } = require("../utils/csvParser");
const logger = require("../shared/lib/logger");
const APIResponse = require("../shared/lib/response");

function uid(req) {
  return req.user?.id || req.user?.userId;
}
function fail(res, error, msg) {
  logger.error(msg, { error: error.message });
  const status = /not found/i.test(error.message) ? 404 : 400;
  return res.status(status).json(APIResponse.error(error.message, "COD_ERROR", null, status));
}

// ---- COD shipments ----
async function ingestCodShipment(req, res) {
  try {
    const record = await codService.ingestCodShipment(req.body);
    res.status(201).json(APIResponse.success(record, "COD shipment ingested"));
  } catch (e) {
    fail(res, e, "ingestCodShipment failed");
  }
}

async function listCodShipments(req, res) {
  try {
    const result = await codService.listCodShipments(req.query);
    res.json(APIResponse.paginated(result.items, result.pagination));
  } catch (e) {
    fail(res, e, "listCodShipments failed");
  }
}

// ---- Collections ----
async function addManualCollection(req, res) {
  try {
    const result = await codService.addCollection({ ...req.body, source: "MANUAL", userId: uid(req) });
    res.status(201).json(APIResponse.success(result, "COD collection recorded"));
  } catch (e) {
    fail(res, e, "addManualCollection failed");
  }
}

async function importCollections(req, res) {
  try {
    const { source, rows } = req.body;
    const report = await codService.importCollections(rows, source, uid(req));
    res.json(APIResponse.success(report, `Imported ${report.successCount}/${report.total} collections`));
  } catch (e) {
    fail(res, e, "importCollections failed");
  }
}

async function importCollectionsCsv(req, res) {
  try {
    const { csv, source = "IMPORT" } = req.body;
    const { rows, errors } = parseCsvCollections(csv);
    if (rows.length === 0) {
      return res
        .status(400)
        .json(APIResponse.error("No valid rows parsed from CSV", "BAD_REQUEST", errors, 400));
    }
    const report = await codService.importCollections(rows, source, uid(req));
    // Merge CSV parse errors into the report
    report.parseErrors = errors;
    res.json(
      APIResponse.success(
        report,
        `Imported ${report.successCount}/${report.total} collections (${errors.length} row(s) skipped)`,
      ),
    );
  } catch (e) {
    fail(res, e, "importCollectionsCsv failed");
  }
}

async function verifyCollection(req, res) {
  try {
    const collection = await codService.verifyCollection(req.params.id, uid(req));
    res.json(APIResponse.success(collection, "Collection verified"));
  } catch (e) {
    fail(res, e, "verifyCollection failed");
  }
}

// ---- Reconciliation ----
async function autoReconcile(req, res) {
  try {
    const result = await reconciliationService.autoReconcile(req.body, uid(req));
    res.json(APIResponse.success(result, "Auto reconciliation complete"));
  } catch (e) {
    fail(res, e, "autoReconcile failed");
  }
}

async function listReconciliations(req, res) {
  try {
    const result = await reconciliationService.listReconciliations(req.query);
    res.json(APIResponse.paginated(result.items, result.pagination));
  } catch (e) {
    fail(res, e, "listReconciliations failed");
  }
}

async function manualReconcile(req, res) {
  try {
    const recon = await reconciliationService.manualReconcile(req.params.codShipmentId, {
      ...req.body,
      userId: uid(req),
    });
    res.json(APIResponse.success(recon, "Reconciliation updated"));
  } catch (e) {
    fail(res, e, "manualReconcile failed");
  }
}

// ---- Reports ----
async function report(req, res) {
  try {
    const { type } = req.params;
    const q = req.query;
    let data;
    switch (type) {
      case "customer-wise":
        data = await reportService.customerWiseCod(q);
        break;
      case "courier-wise":
        data = await reportService.courierWiseCod(q);
        break;
      case "pending-settlement":
        data = await reportService.pendingSettlementReport(q);
        break;
      case "settled":
        data = await reportService.settlementStatusReport("RELEASED", q);
        break;
      case "hold":
        data = await reportService.settlementStatusReport("HOLD", q);
        break;
      case "reconciliation":
        data = await reportService.reconciliationReport(q);
        break;
      case "adjustment":
        data = await reportService.adjustmentReport(q);
        break;
      case "ledger":
        data = await reportService.codLedger(q);
        break;
      case "settlement-summary":
        data = await reportService.settlementSummary(q);
        break;
      default:
        return res.status(400).json(APIResponse.error(`Unknown report type: ${type}`, "BAD_REQUEST", null, 400));
    }
    res.json(APIResponse.success({ type, report: data }));
  } catch (e) {
    fail(res, e, "report failed");
  }
}

module.exports = {
  ingestCodShipment,
  listCodShipments,
  addManualCollection,
  importCollections,
  importCollectionsCsv,
  verifyCollection,
  autoReconcile,
  listReconciliations,
  manualReconcile,
  report,
};
