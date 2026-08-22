/**
 * Invoice Service
 *
 * Issues GST tax invoices and correction notes (credit/debit) for shipments.
 *
 * Numbering: every document series (TAX_INVOICE, and separately CREDIT_NOTE /
 * DEBIT_NOTE) must be gap-free within its own series per GST law, but the
 * different series do NOT need to interleave with each other. We therefore
 * keep separate `InvoiceCounter` rows per financial year:
 *   - "{FY}"      -> TAX_INVOICE sequence      (e.g. "2026-27")
 *   - "{FY}-CN"   -> CREDIT_NOTE sequence       (e.g. "2026-27-CN")
 *   - "{FY}-DN"   -> DEBIT_NOTE sequence        (e.g. "2026-27-DN")
 * This keeps each legally-required series contiguous and independently
 * auditable, while avoiding the complexity of one shared counter where a
 * cancelled/failed note would burn a gap in the tax invoice sequence.
 *
 * Place of supply interpretation (GENUINE AMBIGUITY - flagged for review):
 * Per GST law (Section 12(8) IGST Act) the place of supply for freight/
 * courier services rendered to a registered person is generally the
 * recipient's (billed-to) registered address state. We treat the shipment's
 * `billingState` as the place of supply, falling back to `pickupState` only
 * when `billingState` is absent (e.g. legacy shipments booked before billing
 * address capture). The "supplier state" (the platform's originating state
 * for this transaction) is taken as the shipment's `pickupState`, since that
 * is the closest proxy we have today to the platform's registered place of
 * business for that shipment; the platform does not yet store a per-invoice
 * "supplier GSTIN/state" configuration. A real accountant/compliance review
 * should confirm both of these choices before this is relied on for actual
 * GST filings.
 */

const { prisma } = require("../config/database");
const axios = require("axios");
const logger = require("../shared/lib/logger");
const { ValidationError, NotFoundError } = require("../shared/lib/errors");
const { resolveStateCode } = require("./gstStateCodeMap");

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://user-service:3003";
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || "internal-service-secret";

const GST_LINE_PATTERN = /gst/i;
const HSN_SAC_CODE = "996812"; // SAC for courier/freight/goods transport agency services

// ---------------------------------------------------------------------------
// Financial year helpers
// ---------------------------------------------------------------------------

/**
 * India financial year runs Apr 1 - Mar 31. A date in Jan-Mar is still part
 * of the FY that started the previous April.
 * e.g. 2026-08-22 -> "2026-27"; 2027-02-10 -> "2026-27"
 */
function getFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, 0 = Jan, 3 = Apr
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYearShort = String((fyStartYear + 1) % 100).padStart(2, "0");
  return `${fyStartYear}-${fyEndYearShort}`;
}

function counterKeyFor(financialYear, invoiceType) {
  if (invoiceType === "CREDIT_NOTE") return `${financialYear}-CN`;
  if (invoiceType === "DEBIT_NOTE") return `${financialYear}-DN`;
  return financialYear;
}

function prefixFor(invoiceType) {
  if (invoiceType === "CREDIT_NOTE") return "CN";
  if (invoiceType === "DEBIT_NOTE") return "DN";
  return "INV";
}

/**
 * Atomically increments the counter for (financialYear, invoiceType) and
 * returns the next sequence number. Must be called inside the SAME
 * `prisma.$transaction` that creates the Invoice row, so a rollback on
 * invoice creation also rolls back the counter increment (gap-free).
 */
async function nextInvoiceNumber(tx, financialYear, invoiceType) {
  const counterKey = counterKeyFor(financialYear, invoiceType);

  const counter = await tx.invoiceCounter.upsert({
    where: { financialYear: counterKey },
    create: { financialYear: counterKey, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const padded = String(counter.lastNumber).padStart(6, "0");
  return `${prefixFor(invoiceType)}/${financialYear}/${padded}`;
}

// ---------------------------------------------------------------------------
// Billed-to resolution (calls user-service internal endpoints)
// ---------------------------------------------------------------------------

async function fetchOutletBillingDetails(outletId) {
  const url = `${USER_SERVICE_URL}/api/v1/internal/outlets/${outletId}/billing-details`;
  const response = await axios.get(url, {
    headers: { "X-Internal-Request": INTERNAL_SECRET },
    timeout: 5000,
  });
  return response.data?.data;
}

async function fetchClientBillingDetails(clientId) {
  const url = `${USER_SERVICE_URL}/api/v1/internal/clients/${clientId}/billing-details`;
  const response = await axios.get(url, {
    headers: { "X-Internal-Request": INTERNAL_SECRET },
    timeout: 5000,
  });
  return response.data?.data;
}

/**
 * Parses whatever shape `companyAddress` / `address` happens to be (it is a
 * free-form Json column, not schema-enforced) into the flat address fields
 * the Invoice model stores. Handles the common `{line1, line2, city, state,
 * pincode}` shape and a few likely aliases defensively; returns nulls for
 * anything it can't find rather than throwing, since an invoice with a
 * missing address line is still valid - a missing GSTIN/state is not.
 */
function parseAddressJson(addressJson) {
  if (!addressJson || typeof addressJson !== "object") {
    return {
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      pincode: null,
    };
  }

  const a = addressJson;
  return {
    addressLine1: a.line1 || a.addressLine1 || a.address1 || null,
    addressLine2: a.line2 || a.addressLine2 || a.address2 || null,
    city: a.city || null,
    state: a.state || null,
    pincode: a.pincode || a.pinCode || a.zip || null,
  };
}

/**
 * Resolves the billed-to party for a shipment: outlet billing details if
 * `outletId` is set, else client billing details if `clientId` is set.
 * Throws if neither is present, or if the resolved party is not found.
 */
async function resolveBilledToSnapshot(shipment) {
  let billing;
  let source;

  if (shipment.outletId) {
    billing = await fetchOutletBillingDetails(shipment.outletId);
    source = "outlet";
  } else if (shipment.clientId) {
    billing = await fetchClientBillingDetails(shipment.clientId);
    source = "client";
  } else {
    throw new ValidationError(
      "Shipment has neither outletId nor clientId - cannot resolve billed-to party for invoicing",
    );
  }

  if (!billing || !billing.found) {
    throw new NotFoundError(
      `Billed-to ${source} not found for shipment ${shipment.id} (${source}Id: ${
        source === "outlet" ? shipment.outletId : shipment.clientId
      })`,
    );
  }

  const addressJson =
    source === "outlet" ? billing.companyAddress : billing.address;
  const parsedAddress = parseAddressJson(addressJson);

  return {
    outletId: source === "outlet" ? billing.outletId : null,
    clientId: source === "outlet" ? billing.clientId : billing.clientId,
    billedName: billing.companyName || billing.name || "Unknown",
    billedGstin: billing.gst || null, // null for client-billed shipments - Client model has no GSTIN field, expected
    billedAddressLine1: parsedAddress.addressLine1,
    billedAddressLine2: parsedAddress.addressLine2,
    billedCity: parsedAddress.city,
    billedState: parsedAddress.state,
    billedPincode: parsedAddress.pincode,
  };
}

// ---------------------------------------------------------------------------
// Tax computation
// ---------------------------------------------------------------------------

/**
 * Extracts the GST amount from the quoteSnapshot's chargeBreakdown array by
 * matching an entry whose name contains "gst" (e.g. "Gst 18%").
 */
function extractGstAmount(chargeBreakdown) {
  if (!Array.isArray(chargeBreakdown)) return 0;
  const gstEntry = chargeBreakdown.find((entry) =>
    GST_LINE_PATTERN.test(entry?.name || ""),
  );
  return gstEntry ? Number(gstEntry.amount) || 0 : 0;
}

/**
 * Computes supplyType + tax split for a given taxable base + total GST.
 * INTRA (same state, pickup vs place-of-supply): CGST + SGST, split evenly.
 * INTER (different states): IGST for the full amount.
 */
function computeTaxSplit({
  pickupStateCode,
  placeOfSupplyStateCode,
  gstTotal,
}) {
  const supplyType =
    pickupStateCode === placeOfSupplyStateCode ? "INTRA" : "INTER";
  const rounded = (n) => Math.round(n * 100) / 100;

  if (supplyType === "INTRA") {
    // cgstAmount is rounded independently; sgstAmount absorbs whatever
    // paisa remains so cgst+sgst always sums EXACTLY to gstTotal (a
    // gstTotal with an odd paisa, e.g. 15.03, would otherwise produce
    // 7.52 + 7.52 = 15.04, off by 0.01 from gstTotal).
    const cgstAmount = rounded(gstTotal / 2);
    const sgstAmount = rounded(gstTotal - cgstAmount);
    return {
      supplyType,
      cgstRate: 9,
      cgstAmount,
      sgstRate: 9,
      sgstAmount,
      igstRate: null,
      igstAmount: null,
    };
  }

  return {
    supplyType,
    cgstRate: null,
    cgstAmount: null,
    sgstRate: null,
    sgstAmount: null,
    igstRate: 18,
    igstAmount: rounded(gstTotal),
  };
}

// ---------------------------------------------------------------------------
// issueTaxInvoice
// ---------------------------------------------------------------------------

async function issueTaxInvoice(shipmentId, userId, ipAddress, userAgent) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new NotFoundError(`Shipment not found: ${shipmentId}`);
  }

  if (shipment.status === "CANCELLED") {
    throw new ValidationError(
      "Cannot issue a tax invoice for a CANCELLED shipment - no service was ultimately rendered",
    );
  }

  // The wallet debit (walletTransactionId) is the ground truth that the
  // shipment was actually charged. systemCharge/paymentStatus can be set
  // without a completed debit (e.g. a hold), so we gate on the transaction
  // id specifically - "billed" for GST purposes means money actually moved.
  if (!shipment.walletTransactionId) {
    throw new ValidationError(
      "Cannot issue a tax invoice for a shipment that has not been charged (no wallet transaction on record)",
    );
  }

  // Idempotency fast path: return the existing ISSUED tax invoice if one
  // already exists. This is NOT sufficient on its own under concurrency -
  // two requests can both pass this check before either has committed -
  // so it exists purely to skip the (expensive) billed-to resolution and
  // transaction below in the common sequential-call case. The actual
  // concurrency guarantee comes from the re-check inside the transaction
  // below plus the partial unique index
  // `invoices_one_tax_invoice_per_shipment` (see migration
  // 20260822120000_add_one_tax_invoice_per_shipment_index), which the DB
  // enforces even if two requests both reach the transaction.
  const existing = await prisma.invoice.findFirst({
    where: { shipmentId, invoiceType: "TAX_INVOICE", status: "ISSUED" },
  });
  if (existing) {
    logger.info(
      "Tax invoice already exists for shipment - returning existing",
      {
        service: "shipment-service",
        shipmentId,
        invoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
      },
    );
    return existing;
  }

  const billedTo = await resolveBilledToSnapshot(shipment);

  const pickupStateResolved = resolveStateCode(shipment.pickupState);
  if (!pickupStateResolved.code) {
    throw new ValidationError(
      `Cannot determine supplier (pickup) GST state code: ${pickupStateResolved.reason}`,
    );
  }

  // Place of supply = billing state, falling back to pickup state if absent
  // (see module-level comment on the place-of-supply interpretation).
  const placeOfSupplyStateName = shipment.billingState || shipment.pickupState;
  const placeOfSupplyResolved = resolveStateCode(placeOfSupplyStateName);
  if (!placeOfSupplyResolved.code) {
    throw new ValidationError(
      `Cannot determine place-of-supply GST state code: ${placeOfSupplyResolved.reason}`,
    );
  }

  const chargeBreakdown = shipment.quoteSnapshot?.chargeBreakdown || [];
  const gstTotal = extractGstAmount(chargeBreakdown);
  const totalCost = Number(shipment.totalCost);
  const taxableValue = Math.round((totalCost - gstTotal) * 100) / 100;

  if (taxableValue < 0) {
    throw new ValidationError(
      `Tax computation error: taxableValue (${taxableValue}) is negative - totalCost=${totalCost}, gstTotal=${gstTotal}`,
    );
  }

  const taxSplit = computeTaxSplit({
    pickupStateCode: pickupStateResolved.code,
    placeOfSupplyStateCode: placeOfSupplyResolved.code,
    gstTotal,
  });

  const financialYear = getFinancialYear();

  let invoice;
  let wasCreated;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check for an existing ISSUED tax invoice INSIDE the transaction,
      // immediately before allocating a number and inserting. This closes
      // most of the race window between the fast-path check above and the
      // insert below (a concurrent request that committed in between will
      // now be visible here). The final backstop against the remaining
      // race - two transactions both passing this check before either
      // commits - is the DB-level partial unique index
      // `invoices_one_tax_invoice_per_shipment`, which will reject the
      // loser's INSERT with a 23505 unique violation, caught below.
      const alreadyIssued = await tx.invoice.findFirst({
        where: { shipmentId, invoiceType: "TAX_INVOICE", status: "ISSUED" },
      });
      if (alreadyIssued) {
        return { invoice: alreadyIssued, wasCreated: false };
      }

      const invoiceNumber = await nextInvoiceNumber(
        tx,
        financialYear,
        "TAX_INVOICE",
      );

      const created = await tx.invoice.create({
        data: {
          shipmentId,
          invoiceType: "TAX_INVOICE",
          invoiceNumber,
          financialYear,
          status: "ISSUED",
          // What the customer is being billed FOR. Snapshotted, not joined:
          // an issued invoice must never change if the shipment is later
          // edited, and the recipient needs the order id / AWB / route to
          // reconcile the bill against their consignment.
          orderId: shipment.orderId,
          awbNumber: shipment.awbNumber || null,
          partnerName: shipment.partnerName || null,
          serviceType: shipment.serviceType || null,
          shipmentDate: shipment.createdAt || null,
          originCity: shipment.pickupCity || null,
          originPincode: shipment.pickupPincode || null,
          destinationCity: shipment.deliveryCity || null,
          destinationPincode: shipment.deliveryPincode || null,
          chargeableWeight: shipment.chargeableWeight || null,
          outletId: billedTo.outletId,
          clientId: billedTo.clientId,
          billedName: billedTo.billedName,
          billedGstin: billedTo.billedGstin,
          billedAddressLine1: billedTo.billedAddressLine1,
          billedAddressLine2: billedTo.billedAddressLine2,
          billedCity: billedTo.billedCity,
          billedState: billedTo.billedState,
          billedStateCode: placeOfSupplyResolved.code,
          billedPincode: billedTo.billedPincode,
          placeOfSupplyState: placeOfSupplyStateName,
          placeOfSupplyStateCode: placeOfSupplyResolved.code,
          supplyType: taxSplit.supplyType,
          taxableValue,
          cgstRate: taxSplit.cgstRate,
          cgstAmount: taxSplit.cgstAmount,
          sgstRate: taxSplit.sgstRate,
          sgstAmount: taxSplit.sgstAmount,
          igstRate: taxSplit.igstRate,
          igstAmount: taxSplit.igstAmount,
          totalAmount: totalCost,
          hsnSacCode: HSN_SAC_CODE,
          lineItems: chargeBreakdown,
          createdById: userId || null,
        },
      });
      return { invoice: created, wasCreated: true };
    });
    invoice = result.invoice;
    wasCreated = result.wasCreated;
  } catch (err) {
    // Postgres 23505 = unique_violation. This is the partial unique index
    // `invoices_one_tax_invoice_per_shipment` rejecting a losing concurrent
    // insert (the winner's transaction committed between our in-transaction
    // findFirst and our INSERT). Treat it as the idempotent case: re-fetch
    // and return the invoice the winner created instead of a 500.
    const isUniqueViolation =
      err?.code === "P2002" ||
      err?.meta?.code === "23505" ||
      err?.code === "23505";
    if (!isUniqueViolation) {
      throw err;
    }

    const winner = await prisma.invoice.findFirst({
      where: { shipmentId, invoiceType: "TAX_INVOICE", status: "ISSUED" },
    });
    if (!winner) {
      // Shouldn't happen (the violation implies a row exists), but don't
      // swallow a genuine failure if it somehow does.
      throw err;
    }

    logger.info(
      "Tax invoice creation lost a concurrency race - returning the winning invoice",
      {
        service: "shipment-service",
        shipmentId,
        invoiceId: winner.id,
        invoiceNumber: winner.invoiceNumber,
      },
    );
    return winner;
  }

  if (!wasCreated) {
    // The in-transaction re-check found an already-ISSUED invoice - no new
    // row was created, so skip the CREATE audit log / issued log below.
    logger.info(
      "Tax invoice already existed at transaction time - returning existing",
      {
        service: "shipment-service",
        shipmentId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    );
    return invoice;
  }

  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: "CREATE",
      resource: "invoice",
      resourceId: invoice.id,
      changes: {
        invoiceType: "TAX_INVOICE",
        invoiceNumber: invoice.invoiceNumber,
        shipmentId,
        taxableValue,
        totalAmount: totalCost,
        supplyType: taxSplit.supplyType,
      },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      clientId: shipment.clientId || null,
    },
  });

  logger.info("Tax invoice issued", {
    service: "shipment-service",
    shipmentId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  });

  return invoice;
}

// ---------------------------------------------------------------------------
// issueAdjustmentNote
// ---------------------------------------------------------------------------

async function issueAdjustmentNote(
  financialAdjustmentId,
  userId,
  ipAddress,
  userAgent,
) {
  const adjustment = await prisma.shipmentFinancialAdjustment.findUnique({
    where: { id: financialAdjustmentId },
    include: { shipment: true },
  });

  if (!adjustment) {
    throw new NotFoundError(
      `Financial adjustment not found: ${financialAdjustmentId}`,
    );
  }

  const originalInvoice = await prisma.invoice.findFirst({
    where: {
      shipmentId: adjustment.shipmentId,
      invoiceType: "TAX_INVOICE",
      status: "ISSUED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!originalInvoice) {
    // No invoice exists yet - nothing to correct. This is expected when
    // rerateShipment fires before an invoice was ever issued; the eventual
    // invoice will simply reflect the corrected amount. Not an error.
    logger.warn(
      "No issued tax invoice found for shipment - skipping adjustment note issuance",
      {
        service: "shipment-service",
        shipmentId: adjustment.shipmentId,
        financialAdjustmentId,
      },
    );
    return null;
  }

  const difference = Number(adjustment.difference);
  if (difference === 0) {
    logger.info("Financial adjustment has zero difference - no note needed", {
      service: "shipment-service",
      financialAdjustmentId,
    });
    return null;
  }

  const invoiceType = difference > 0 ? "DEBIT_NOTE" : "CREDIT_NOTE";
  const deltaAmount = Math.abs(difference);

  // Reuse the original invoice's stored billed-to snapshot rather than
  // re-fetching from user-service: a note is legally correcting THAT
  // invoice's billed party, not whatever the outlet/client's details happen
  // to be today.
  // Recompute the tax split proportionally on the delta, using the same
  // supplyType as the original invoice (place of supply doesn't change
  // between the invoice and its correcting note).
  const gstTotalOnOriginal =
    Number(originalInvoice.cgstAmount || 0) +
    Number(originalInvoice.sgstAmount || 0) +
    Number(originalInvoice.igstAmount || 0);
  const originalTotal = Number(originalInvoice.totalAmount);
  const gstRatio = originalTotal !== 0 ? gstTotalOnOriginal / originalTotal : 0;

  const deltaGst = Math.round(deltaAmount * gstRatio * 100) / 100;
  const deltaTaxableValue = Math.round((deltaAmount - deltaGst) * 100) / 100;

  const taxSplit =
    originalInvoice.supplyType === "INTRA"
      ? (() => {
          // Same exact-sum fix as computeTaxSplit: sgstAmount absorbs the
          // rounding remainder rather than being independently rounded.
          const cgstAmount = Math.round((deltaGst / 2) * 100) / 100;
          const sgstAmount = Math.round((deltaGst - cgstAmount) * 100) / 100;
          return {
            supplyType: "INTRA",
            cgstRate: 9,
            cgstAmount,
            sgstRate: 9,
            sgstAmount,
            igstRate: null,
            igstAmount: null,
          };
        })()
      : {
          supplyType: "INTER",
          cgstRate: null,
          cgstAmount: null,
          sgstRate: null,
          sgstAmount: null,
          igstRate: 18,
          igstAmount: deltaGst,
        };

  const financialYear = getFinancialYear();

  const note = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(
      tx,
      financialYear,
      invoiceType,
    );

    return tx.invoice.create({
      data: {
        shipmentId: adjustment.shipmentId,
        invoiceType,
        invoiceNumber,
        financialYear,
        status: "ISSUED",
        originalInvoiceId: originalInvoice.id,
        financialAdjustmentId: adjustment.id,
        outletId: originalInvoice.outletId,
        clientId: originalInvoice.clientId,
        billedName: originalInvoice.billedName,
        billedGstin: originalInvoice.billedGstin,
        billedAddressLine1: originalInvoice.billedAddressLine1,
        billedAddressLine2: originalInvoice.billedAddressLine2,
        billedCity: originalInvoice.billedCity,
        billedState: originalInvoice.billedState,
        billedStateCode: originalInvoice.billedStateCode,
        billedPincode: originalInvoice.billedPincode,
        placeOfSupplyState: originalInvoice.placeOfSupplyState,
        placeOfSupplyStateCode: originalInvoice.placeOfSupplyStateCode,
        supplyType: taxSplit.supplyType,
        taxableValue: deltaTaxableValue,
        cgstRate: taxSplit.cgstRate,
        cgstAmount: taxSplit.cgstAmount,
        sgstRate: taxSplit.sgstRate,
        sgstAmount: taxSplit.sgstAmount,
        igstRate: taxSplit.igstRate,
        igstAmount: taxSplit.igstAmount,
        // Signed per schema comment: positive for DEBIT_NOTE, negative for CREDIT_NOTE.
        totalAmount: invoiceType === "DEBIT_NOTE" ? deltaAmount : -deltaAmount,
        hsnSacCode: originalInvoice.hsnSacCode,
        lineItems: [
          {
            name: `${invoiceType === "DEBIT_NOTE" ? "Additional charge" : "Refund"} - ${adjustment.reason}`,
            amount: deltaAmount,
          },
        ],
        createdById: userId || null,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: "CREATE",
      resource: "invoice",
      resourceId: note.id,
      changes: {
        invoiceType,
        invoiceNumber: note.invoiceNumber,
        shipmentId: adjustment.shipmentId,
        financialAdjustmentId: adjustment.id,
        originalInvoiceId: originalInvoice.id,
        deltaAmount,
      },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      clientId: adjustment.shipment?.clientId || null,
    },
  });

  logger.info("Adjustment note issued", {
    service: "shipment-service",
    invoiceType,
    invoiceId: note.id,
    invoiceNumber: note.invoiceNumber,
    shipmentId: adjustment.shipmentId,
  });

  return note;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

async function getInvoiceById(id) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    throw new NotFoundError(`Invoice not found: ${id}`);
  }
  return invoice;
}

async function listInvoices({
  shipmentId,
  outletId,
  clientId,
  dateFrom,
  dateTo,
  status,
  invoiceType,
  page = 1,
  limit = 20,
} = {}) {
  const where = {};

  // A shipment's tax invoice and any credit/debit notes raised against it all
  // carry its shipmentId, so this returns the whole document set for one
  // shipment in issue order — which is how the shipment page reads it.
  if (shipmentId) where.shipmentId = shipmentId;
  if (outletId) where.outletId = outletId;
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (invoiceType) where.invoiceType = invoiceType;

  if (dateFrom || dateTo) {
    where.issueDate = {};
    if (dateFrom) where.issueDate.gte = new Date(dateFrom);
    if (dateTo) where.issueDate.lte = new Date(dateTo);
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const offset = (pageNum - 1) * limitNum;

  const [invoices, totalCount] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limitNum,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
    },
  };
}

module.exports = {
  getFinancialYear,
  issueTaxInvoice,
  issueAdjustmentNote,
  getInvoiceById,
  listInvoices,
};
