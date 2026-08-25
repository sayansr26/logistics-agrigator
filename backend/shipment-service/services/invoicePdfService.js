/**
 * Invoice PDF Service
 *
 * Renders an Invoice row to a PDF document with pdfkit and stores it on
 * disk, following the same storage convention as labelGenerationService.js
 * (a directory under `generated/`, filename with the document identifier +
 * timestamp, `fs`/`path.join`).
 */

const fsPromises = require("fs").promises;
const path = require("path");
const PDFDocument = require("pdfkit");
const logger = require("../shared/lib/logger");
const { APIError } = require("../shared/lib/errors");

// Platform's own registered business details for the invoice header.
// No such config exists yet in this codebase (checked env vars and
// config/), so these fall back to clearly-marked placeholders. Set
// PLATFORM_COMPANY_NAME / PLATFORM_GSTIN / PLATFORM_ADDRESS env vars to
// override with the real registered details before relying on this for
// actual GST filings.
const PLATFORM_COMPANY_NAME =
  process.env.PLATFORM_COMPANY_NAME || "SUB Solution";
const PLATFORM_ADDRESS =
  process.env.PLATFORM_ADDRESS ||
  "401, Pooja Complex, Veer Savarkar Block, Shakarpur, Delhi 110092";
const PLATFORM_PHONE = process.env.PLATFORM_PHONE || "+91 98105 92557";
const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || "support@subsolution.in";
const PLATFORM_WEBSITE = process.env.PLATFORM_WEBSITE || "subsolution.in";
// GSTIN is the one detail with no safe default — a wrong or invented GSTIN on a
// tax invoice is a compliance problem, so it stays an explicit placeholder
// until PLATFORM_GSTIN is configured with the real registered number.
const PLATFORM_GSTIN = process.env.PLATFORM_GSTIN || "GSTIN NOT CONFIGURED";

/** SUB Solution's brand orange, matching the web mark. */
const BRAND_ORANGE = "#F04E23";
const INK = "#161B1E";
const MUTED = "#5A666B";

/**
 * The logo mark, drawn as vectors rather than a bitmap so it stays crisp at any
 * print size and needs no asset file on disk. Mirrors the SVG in
 * frontend/src/components/landing/chrome/logo.tsx.
 */
function drawLogoMark(doc, x, y, size) {
  const s = size / 64;
  doc.save();
  doc
    .lineWidth(11 * s)
    .lineJoin("round")
    .strokeColor(BRAND_ORANGE)
    .moveTo(x + 52 * s, y + 14 * s)
    .lineTo(x + 32 * s, y + 14 * s)
    .bezierCurveTo(
      x + 16 * s,
      y + 14 * s,
      x + 16 * s,
      y + 30 * s,
      x + 32 * s,
      y + 32 * s,
    )
    .bezierCurveTo(
      x + 48 * s,
      y + 34 * s,
      x + 48 * s,
      y + 50 * s,
      x + 32 * s,
      y + 50 * s,
    )
    .lineTo(x + 12 * s, y + 50 * s)
    .stroke();

  doc.fillColor(BRAND_ORANGE);
  doc
    .moveTo(x + 51 * s, y + 2 * s)
    .lineTo(x + 64 * s, y + 14 * s)
    .lineTo(x + 51 * s, y + 26 * s)
    .fill();
  doc
    .moveTo(x + 13 * s, y + 38 * s)
    .lineTo(x + 0 * s, y + 50 * s)
    .lineTo(x + 13 * s, y + 62 * s)
    .fill();
  doc.restore();
}

function formatCurrency(amount) {
  const n = Number(amount || 0);
  return `Rs. ${n.toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function drawHeader(doc, invoice) {
  const top = doc.y;

  drawLogoMark(doc, doc.page.margins.left, top, 30);

  const textX = doc.page.margins.left + 40;
  doc.fontSize(16).font("Helvetica-Bold");

  // An explicit PLATFORM_COMPANY_NAME wins and prints as plain text — a
  // white-labelled deployment must be able to put its own name here. Only the
  // default falls back to the two-tone SUB Solution wordmark.
  if (process.env.PLATFORM_COMPANY_NAME) {
    doc.fillColor(INK).text(PLATFORM_COMPANY_NAME, textX, top + 2);
  } else {
    doc
      .fillColor(BRAND_ORANGE)
      .text("SUB", textX, top + 2, { continued: true })
      .fillColor(INK)
      .text(" Solution");
  }

  doc
    .fontSize(8.5)
    .font("Helvetica")
    .fillColor(MUTED)
    .text(PLATFORM_ADDRESS, textX, doc.y + 1, { width: 290 })
    .text(`${PLATFORM_PHONE}  ·  ${PLATFORM_EMAIL}  ·  ${PLATFORM_WEBSITE}`, {
      width: 290,
    })
    .fillColor(INK)
    .font("Helvetica-Bold")
    .text(`GSTIN: ${PLATFORM_GSTIN}`, { width: 290 });

  doc.font("Helvetica").fillColor(INK);
  doc.y = top;
  doc.moveDown(0.5);

  const documentTitle =
    invoice.invoiceType === "CREDIT_NOTE"
      ? "CREDIT NOTE"
      : invoice.invoiceType === "DEBIT_NOTE"
        ? "DEBIT NOTE"
        : "TAX INVOICE";

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(documentTitle, { align: "right" });
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(`Invoice No: ${invoice.invoiceNumber}`, { align: "right" })
    .text(`Date: ${formatDate(invoice.issueDate)}`, { align: "right" })
    .text(`Financial Year: ${invoice.financialYear}`, { align: "right" });

  doc.moveDown(1);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#999999")
    .stroke();
  doc.moveDown(0.5);
}

function drawBilledTo(doc, invoice) {
  doc.fontSize(10).font("Helvetica-Bold").text("Billed To:");
  doc.font("Helvetica").fontSize(9);
  doc.text(invoice.billedName || "-");
  if (invoice.billedAddressLine1) doc.text(invoice.billedAddressLine1);
  if (invoice.billedAddressLine2) doc.text(invoice.billedAddressLine2);
  const cityLine = [
    invoice.billedCity,
    invoice.billedState,
    invoice.billedPincode,
  ]
    .filter(Boolean)
    .join(", ");
  if (cityLine) doc.text(cityLine);
  doc.text(`GSTIN: ${invoice.billedGstin || "Not registered / not available"}`);
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Place of Supply: ", { continued: true });
  doc
    .font("Helvetica")
    .text(`${invoice.placeOfSupplyState} (${invoice.placeOfSupplyStateCode})`);
  doc.font("Helvetica-Bold").text("Supply Type: ", { continued: true });
  doc.font("Helvetica").text(invoice.supplyType);
  doc.font("Helvetica-Bold").text("HSN/SAC Code: ", { continued: true });
  doc.font("Helvetica").text(invoice.hsnSacCode);
  if (invoice.originalInvoiceId) {
    doc.font("Helvetica-Bold").text("Against Invoice: ", { continued: true });
    doc.font("Helvetica").text(invoice.originalInvoiceId);
  }
  doc.moveDown(1);

  drawShipmentDetails(doc, invoice);
}

/**
 * What the customer is being billed for.
 *
 * Without this the invoice carried only an internal shipment UUID, which a
 * recipient cannot reconcile against anything. Order id and AWB are the two
 * references they actually hold.
 */
function drawShipmentDetails(doc, invoice) {
  const rows = [
    ["Order ID", invoice.orderId],
    ["AWB / Tracking No", invoice.awbNumber],
    ["Courier", invoice.partnerName],
    ["Service", invoice.serviceType],
    [
      "Route",
      invoice.originCity || invoice.destinationCity
        ? `${invoice.originCity || "-"}${
            invoice.originPincode ? ` (${invoice.originPincode})` : ""
          }  to  ${invoice.destinationCity || "-"}${
            invoice.destinationPincode ? ` (${invoice.destinationPincode})` : ""
          }`
        : null,
    ],
    [
      "Chargeable Weight",
      invoice.chargeableWeight === null ||
      invoice.chargeableWeight === undefined
        ? null
        : `${Number(invoice.chargeableWeight)} kg`,
    ],
    [
      "Shipment Date",
      invoice.shipmentDate ? formatDate(invoice.shipmentDate) : null,
    ],
  ].filter(([, value]) => value);

  if (rows.length === 0) return;

  doc.fontSize(10).font("Helvetica-Bold").text("Shipment Details:");
  doc.moveDown(0.3);
  doc.fontSize(9);

  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
    doc.font("Helvetica").text(String(value));
  }

  doc.moveDown(1);
}

function drawLineItemsTable(doc, invoice) {
  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

  const tableTop = doc.y;
  const colDesc = doc.page.margins.left;
  const colAmount = doc.page.width - doc.page.margins.right - 100;

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Description", colDesc, tableTop);
  doc.text("Amount", colAmount, tableTop, { width: 100, align: "right" });
  doc.moveDown(0.3);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(9);
  lineItems.forEach((item) => {
    const y = doc.y;
    doc.text(item.name || "Charge", colDesc, y, {
      width: colAmount - colDesc - 10,
    });
    doc.text(formatCurrency(item.amount), colAmount, y, {
      width: 100,
      align: "right",
    });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.5);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.5);
}

function drawTaxSummary(doc, invoice) {
  const colLabel = doc.page.width - doc.page.margins.right - 220;
  const colValue = doc.page.width - doc.page.margins.right - 100;

  const row = (label, value, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
    doc.text(label, colLabel, doc.y, { width: 120, align: "left" });
    doc.text(value, colValue, doc.y - doc.currentLineHeight(), {
      width: 100,
      align: "right",
    });
    doc.moveDown(0.4);
  };

  row("Taxable Value", formatCurrency(invoice.taxableValue));

  if (invoice.supplyType === "INTRA") {
    row(`CGST @ ${invoice.cgstRate}%`, formatCurrency(invoice.cgstAmount));
    row(`SGST @ ${invoice.sgstRate}%`, formatCurrency(invoice.sgstAmount));
  } else {
    row(`IGST @ ${invoice.igstRate}%`, formatCurrency(invoice.igstAmount));
  }

  doc
    .moveTo(colLabel, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#999999")
    .stroke();
  doc.moveDown(0.3);

  row("Total Amount", formatCurrency(invoice.totalAmount), true);
}

/**
 * Annexure: every wallet movement this shipment caused. The tax figures above
 * describe the invoice as issued; this table describes what actually moved in
 * the wallet, which after re-rates is a longer story (reversal + re-charge per
 * adjustment). Fed by invoice.walletLedger — omitted entirely when absent, so
 * an invoice generated without a ledger is unchanged.
 */
function drawWalletTransactions(doc, invoice) {
  const ledger = invoice.walletLedger;
  const rows = Array.isArray(ledger?.transactions) ? ledger.transactions : [];
  if (!rows.length) return;

  // Keep the annexure whole rather than orphaning its header at a page break.
  const estimatedHeight = 60 + rows.length * 16 + 50;
  if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  doc.moveDown(1);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(INK)
    .text("Wallet Transactions", doc.page.margins.left, doc.y);
  doc.moveDown(0.2);
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(
      "Money movement recorded against this shipment. Re-rates reverse the previous charge in full before charging the revised amount.",
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      },
    );
  doc.moveDown(0.5);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const colTxn = left;
  const colDate = left + 55;
  const colDesc = left + 135;
  const colAmount = right - 80;

  const headerY = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
  doc.text("Txn", colTxn, headerY, { width: 50 });
  doc.text("Date", colDate, headerY, { width: 75 });
  doc.text("Description", colDesc, headerY, {
    width: colAmount - colDesc - 10,
  });
  doc.text("Amount", colAmount, headerY, { width: 80, align: "right" });
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(8);
  rows.forEach((row) => {
    const y = doc.y;
    const signed =
      row.kind === "NONE"
        ? "—"
        : `${row.kind === "REFUND" ? "+" : "-"}${formatCurrency(row.amount || 0)}`;

    doc
      .fillColor(MUTED)
      .text(row.transactionId ? `#${row.transactionId}` : "—", colTxn, y, {
        width: 50,
      });
    doc.text(row.occurredAt ? formatDate(row.occurredAt) : "—", colDate, y, {
      width: 75,
    });
    doc
      .fillColor(INK)
      .text(
        row.reason ? `${row.label} — ${row.reason}` : row.label,
        colDesc,
        y,
        { width: colAmount - colDesc - 10 },
      );
    doc
      .fillColor(row.kind === "NONE" ? MUTED : INK)
      .text(signed, colAmount, y, { width: 80, align: "right" });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.3);

  const totalRow = (label, value, bold = false) => {
    const y = doc.y;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8)
      .fillColor(INK);
    doc.text(label, colDesc, y, {
      width: colAmount - colDesc - 10,
      align: "right",
    });
    doc.text(value, colAmount, y, { width: 80, align: "right" });
    doc.moveDown(0.3);
  };

  totalRow("Total debited", formatCurrency(ledger.summary?.totalDebited || 0));
  totalRow(
    "Total refunded",
    formatCurrency(ledger.summary?.totalRefunded || 0),
  );
  totalRow(
    "Net charged",
    formatCurrency(ledger.summary?.netCharged || 0),
    true,
  );

  doc.fillColor(INK);
}

function drawFooter(doc) {
  doc.moveDown(2);
  doc
    .fontSize(7.5)
    .font("Helvetica-Oblique")
    .fillColor("#666666")
    .text(
      "This is a system-generated document. Place of supply and supplier state are derived from shipment pickup/billing addresses; please have your accounts/compliance team verify before GST filing.",
      { align: "left" },
    );
}

/**
 * Builds a PDF buffer for the given invoice (does not write to disk).
 */
function buildInvoicePdfBuffer(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawHeader(doc, invoice);
      drawBilledTo(doc, invoice);
      drawLineItemsTable(doc, invoice);
      drawTaxSummary(doc, invoice);
      drawWalletTransactions(doc, invoice);
      drawFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates the invoice PDF, saves it to disk under generated/invoices/
 * (same convention as generated/labels/ in labelGenerationService.js), and
 * returns { filePath, filename, fileSize }. Does NOT update the DB row -
 * callers persist `pdfUrl` themselves.
 */
async function generateInvoicePdf(invoice) {
  try {
    const invoicesDir = path.join(process.cwd(), "generated", "invoices");
    await fsPromises.mkdir(invoicesDir, { recursive: true });

    const safeNumber = invoice.invoiceNumber.replace(/[/\\]/g, "-");
    const filename = `invoice_${safeNumber}.pdf`;
    const filePath = path.join(invoicesDir, filename);

    const buffer = await buildInvoicePdfBuffer(invoice);
    await fsPromises.writeFile(filePath, buffer);

    const stats = await fsPromises.stat(filePath);

    logger.info("Invoice PDF generated", {
      service: "shipment-service",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      filePath,
      fileSize: stats.size,
    });

    return { filePath, filename, fileSize: stats.size };
  } catch (error) {
    logger.error("Invoice PDF generation error", {
      service: "shipment-service",
      invoiceId: invoice.id,
      error: error.message,
    });
    throw new APIError(
      `Invoice PDF generation failed: ${error.message}`,
      500,
      "INVOICE_PDF_ERROR",
    );
  }
}

module.exports = {
  generateInvoicePdf,
  buildInvoicePdfBuffer,
};
