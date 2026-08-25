/**
 * Label PDF Renderer
 *
 * Renders a white-label shipping label with PDFKit. The label carries the
 * outlet / client branding resolved by labelBrandingService — never the
 * aggregator's courier account name — plus everything the courier needs to
 * move the parcel: a Code 128 barcode of the AWB, destination pincode,
 * consignee, return address, payment mode and package details.
 *
 * Pure module: content in, PDF Buffer out. No database or network access.
 */

const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

const PT_PER_MM = 72 / 25.4;
const LABEL_W = 288; // 4in
const LABEL_H = 432; // 6in
const A4 = [210 * PT_PER_MM, 297 * PT_PER_MM];

const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_MONO = "Courier-Bold";
const GREY = "#555555";
const BLACK = "#000000";
const LINE = "#000000";

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function joinParts(parts, separator = ", ") {
  return parts.map(text).filter(Boolean).join(separator);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `Rs. ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function makeBarcode(bcid, value, options = {}) {
  if (!value) return null;
  try {
    return await bwipjs.toBuffer({
      bcid,
      text: String(value),
      scale: 3,
      includetext: false,
      backgroundcolor: "FFFFFF",
      ...options,
    });
  } catch (_error) {
    return null;
  }
}

/**
 * Build the barcode/QR images once; they are reused across copies.
 */
async function buildAssets(content) {
  const { shipmentInfo, labelOptions } = content;
  const barcodeValue = shipmentInfo.awbNumber || shipmentInfo.orderId;

  const [barcode, qr] = await Promise.all([
    labelOptions.includeBarcode !== false
      ? makeBarcode("code128", barcodeValue, { height: 12 })
      : null,
    labelOptions.includeQRCode !== false && shipmentInfo.trackingUrl
      ? makeBarcode("qrcode", shipmentInfo.trackingUrl, { scale: 2 })
      : null,
  ]);

  return { barcode, qr };
}

/**
 * Draw one label with its top-left corner at the current transform origin.
 * All positions are in points on a LABEL_W x LABEL_H canvas.
 */
function drawLabel(doc, content, assets) {
  const {
    brand,
    courier,
    shipmentInfo,
    payment,
    deliveryAddress,
    returnAddress,
    packageInfo,
  } = content;

  const PAD = 8;
  const innerX = PAD;
  const innerW = LABEL_W - PAD * 2;
  let y = 0;

  const hline = (atY) => {
    doc
      .moveTo(0, atY)
      .lineTo(LABEL_W, atY)
      .lineWidth(0.8)
      .strokeColor(LINE)
      .stroke();
  };
  const vline = (atX, fromY, toY) => {
    doc
      .moveTo(atX, fromY)
      .lineTo(atX, toY)
      .lineWidth(0.8)
      .strokeColor(LINE)
      .stroke();
  };
  const label = (str, x, atY, opts = {}) => {
    doc
      .font(FONT)
      .fontSize(5.5)
      .fillColor(GREY)
      .text(str.toUpperCase(), x, atY, { lineBreak: false, ...opts });
  };

  // Outer border
  doc.rect(0, 0, LABEL_W, LABEL_H).lineWidth(1).strokeColor(LINE).stroke();

  // ---------------------------------------------------------------- Header
  const headerH = 52;
  const headerSplit = 196;
  doc
    .font(FONT_BOLD)
    .fontSize(13)
    .fillColor(BLACK)
    .text(text(brand.brandName).toUpperCase() || "SHIPPER", innerX, 9, {
      width: headerSplit - innerX - 4,
      height: 32,
      ellipsis: true,
      lineGap: -1,
    });
  const subline = joinParts(
    [
      brand.legalName && brand.legalName !== brand.brandName
        ? brand.legalName
        : null,
      brand.gstin ? `GSTIN ${brand.gstin}` : null,
    ],
    "  |  ",
  );
  if (subline) {
    doc
      .font(FONT)
      .fontSize(6)
      .fillColor(GREY)
      .text(subline, innerX, headerH - 11, {
        width: headerSplit - innerX - 4,
        height: 8,
        ellipsis: true,
        lineBreak: false,
      });
  }

  vline(headerSplit, 0, headerH);
  label("Ship via", headerSplit + 6, 8);
  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(BLACK)
    .text(text(courier.partnerName) || "Courier", headerSplit + 6, 16, {
      width: LABEL_W - headerSplit - 10,
      height: 12,
      ellipsis: true,
      lineBreak: false,
    });
  doc
    .font(FONT)
    .fontSize(6.5)
    .fillColor(GREY)
    .text(
      joinParts([courier.serviceType, courier.channelName], " · "),
      headerSplit + 6,
      29,
      {
        width: LABEL_W - headerSplit - 10,
        height: 18,
        ellipsis: true,
      },
    );
  y = headerH;
  hline(y);

  // --------------------------------------------------------------- Barcode
  const barcodeH = 72;
  if (assets.barcode) {
    doc.image(assets.barcode, innerX + 14, y + 7, {
      fit: [innerW - 28, 44],
      align: "center",
      valign: "center",
    });
  }
  const awbText = shipmentInfo.awbNumber
    ? text(shipmentInfo.awbNumber)
    : `AWB PENDING · ${text(shipmentInfo.orderId)}`;
  doc
    .font(FONT_MONO)
    .fontSize(shipmentInfo.awbNumber ? 11 : 8)
    .fillColor(BLACK)
    .text(awbText, innerX, y + barcodeH - 17, {
      width: innerW,
      align: "center",
      lineBreak: false,
    });
  y += barcodeH;
  hline(y);

  // ------------------------------------------------------------ Info strip
  const stripH = 32;
  const cellW = LABEL_W / 3;
  const cells = [
    { title: "Order ID", value: text(shipmentInfo.orderId), mono: true },
    {
      title: "Payment",
      value:
        payment.paymentType === "COD"
          ? `COD ${formatMoney(payment.codAmount)}`
          : "PREPAID",
      bold: true,
    },
    { title: "Booked", value: formatDate(shipmentInfo.createdAt) },
  ];
  cells.forEach((cell, i) => {
    const cx = i * cellW;
    if (i > 0) vline(cx, y, y + stripH);
    label(cell.title, cx + 6, y + 5);
    doc
      .font(cell.mono ? FONT_MONO : cell.bold ? FONT_BOLD : FONT)
      .fontSize(cell.bold ? 9.5 : 8.5)
      .fillColor(BLACK)
      .text(cell.value, cx + 6, y + 14, {
        width: cellW - 10,
        height: 12,
        ellipsis: true,
        lineBreak: false,
      });
  });
  y += stripH;
  hline(y);

  // ----------------------------------------------------------- Destination
  const destH = 34;
  label("Deliver to pincode", innerX, y + 5);
  doc
    .font(FONT_BOLD)
    .fontSize(20)
    .fillColor(BLACK)
    .text(text(deliveryAddress.pincode) || "------", innerX, y + 11, {
      lineBreak: false,
    });
  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(BLACK)
    .text(
      joinParts([deliveryAddress.city, deliveryAddress.state]).toUpperCase(),
      LABEL_W / 2,
      y + 14,
      {
        width: LABEL_W / 2 - PAD,
        align: "right",
        height: 12,
        ellipsis: true,
        lineBreak: false,
      },
    );
  y += destH;
  hline(y);

  // ------------------------------------------------------------ Consignee
  const consigneeH = 76;
  label("Deliver to", innerX, y + 5);
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(BLACK)
    .text(text(deliveryAddress.name) || "-", innerX, y + 13, {
      width: innerW,
      height: 13,
      ellipsis: true,
      lineBreak: false,
    });
  doc
    .font(FONT)
    .fontSize(7.5)
    .fillColor(BLACK)
    .text(
      joinParts(
        [
          deliveryAddress.line1,
          deliveryAddress.line2,
          deliveryAddress.landmark
            ? `Landmark: ${deliveryAddress.landmark}`
            : null,
          joinParts([deliveryAddress.city, deliveryAddress.state], " "),
          deliveryAddress.pincode ? `PIN ${deliveryAddress.pincode}` : null,
        ],
        ", ",
      ),
      innerX,
      y + 27,
      { width: innerW, height: 30, ellipsis: true, lineGap: 0.5 },
    );
  doc
    .font(FONT_BOLD)
    .fontSize(8)
    .fillColor(BLACK)
    .text(
      deliveryAddress.phone ? `Ph: ${text(deliveryAddress.phone)}` : "",
      innerX,
      y + consigneeH - 13,
      { width: innerW, lineBreak: false },
    );
  y += consigneeH;
  hline(y);

  // --------------------------------------------------------- Return / from
  const returnH = 60;
  label("Shipped from / return to", innerX, y + 5);
  doc
    .font(FONT_BOLD)
    .fontSize(8.5)
    .fillColor(BLACK)
    .text(text(returnAddress.name) || text(brand.brandName), innerX, y + 13, {
      width: innerW,
      height: 11,
      ellipsis: true,
      lineBreak: false,
    });
  doc
    .font(FONT)
    .fontSize(7)
    .fillColor(BLACK)
    .text(
      joinParts(
        [
          returnAddress.line1,
          returnAddress.line2,
          joinParts([returnAddress.city, returnAddress.state], " "),
          returnAddress.pincode ? `PIN ${returnAddress.pincode}` : null,
        ],
        ", ",
      ),
      innerX,
      y + 25,
      { width: innerW, height: 20, ellipsis: true, lineGap: 0.5 },
    );
  doc
    .font(FONT)
    .fontSize(7)
    .fillColor(BLACK)
    .text(
      joinParts(
        [
          returnAddress.phone ? `Ph: ${text(returnAddress.phone)}` : null,
          brand.gstin ? `GSTIN ${brand.gstin}` : null,
        ],
        "   ",
      ),
      innerX,
      y + returnH - 12,
      { width: innerW, lineBreak: false },
    );
  y += returnH;
  hline(y);

  // --------------------------------------------------------------- Package
  const packageH = 58;
  const pkgSplit = 170;
  label("Contents", innerX, y + 5);
  doc
    .font(FONT)
    .fontSize(7.5)
    .fillColor(BLACK)
    .text(text(packageInfo.description) || "Package", innerX, y + 13, {
      width: pkgSplit - innerX - 4,
      height: 20,
      ellipsis: true,
      lineGap: 0.5,
    });
  doc
    .font(FONT)
    .fontSize(6.5)
    .fillColor(GREY)
    .text(
      joinParts(
        [
          packageInfo.hsnCode ? `HSN ${packageInfo.hsnCode}` : null,
          `Qty ${packageInfo.quantity || 1}`,
          payment.declaredValue
            ? `Value ${formatMoney(payment.declaredValue)}`
            : null,
        ],
        "  ·  ",
      ),
      innerX,
      y + packageH - 14,
      { width: pkgSplit - innerX - 4, lineBreak: false },
    );

  vline(pkgSplit, y, y + packageH);
  const rightX = pkgSplit + 6;
  const rightW = LABEL_W - pkgSplit - 10;
  label("Weight", rightX, y + 5);
  doc
    .font(FONT_BOLD)
    .fontSize(9.5)
    .fillColor(BLACK)
    .text(
      packageInfo.chargeableWeight ? `${packageInfo.chargeableWeight} kg` : "-",
      rightX,
      y + 13,
      { width: rightW, lineBreak: false },
    );
  label("Dimensions (cm)", rightX, y + 29);
  doc
    .font(FONT)
    .fontSize(8)
    .fillColor(BLACK)
    .text(text(packageInfo.dimensions) || "-", rightX, y + 37, {
      width: rightW,
      lineBreak: false,
    });
  y += packageH;
  hline(y);

  // ---------------------------------------------------------------- Footer
  const footerY = y;
  const footerH = LABEL_H - footerY;
  if (assets.qr) {
    doc.image(assets.qr, LABEL_W - PAD - 36, footerY + (footerH - 36) / 2, {
      fit: [36, 36],
    });
  }
  if (shipmentInfo.fragile) {
    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .fillColor(BLACK)
      .text("FRAGILE - HANDLE WITH CARE", innerX, footerY + 8, {
        lineBreak: false,
      });
  }
  doc
    .font(FONT)
    .fontSize(6)
    .fillColor(GREY)
    .text(
      joinParts(
        [
          shipmentInfo.trackingUrl
            ? `Track: ${shipmentInfo.trackingUrl}`
            : null,
          shipmentInfo.shipmentType ? `${shipmentInfo.shipmentType}` : null,
        ],
        "   ",
      ),
      innerX,
      footerY + footerH - 14,
      {
        width: innerW - (assets.qr ? 44 : 0),
        height: 8,
        ellipsis: true,
        lineBreak: false,
      },
    );
}

/**
 * Lay copies of the label out on pages according to the requested format.
 *
 *   4x6  — one label per 4x6in page (thermal printers)
 *   6x4  — same label rotated onto a landscape 6x4in page
 *   A4   — one label per A4 page, top-left with a margin
 *   A4_4 — four labels per A4 page (2x2 grid)
 */
function layoutPages(doc, content, assets, format, copies) {
  const draw = () => drawLabel(doc, content, assets);

  if (format === "A4_4") {
    const cellW = A4[0] / 2;
    const cellH = A4[1] / 2;
    const scale = Math.min(cellW / LABEL_W, cellH / LABEL_H) * 0.97;
    const offsetX = (cellW - LABEL_W * scale) / 2;
    const offsetY = (cellH - LABEL_H * scale) / 2;

    for (let i = 0; i < copies; i++) {
      const slot = i % 4;
      if (slot === 0 && i > 0) doc.addPage({ size: A4, margin: 0 });
      const col = slot % 2;
      const row = Math.floor(slot / 2);
      doc.save();
      doc.translate(col * cellW + offsetX, row * cellH + offsetY);
      doc.scale(scale);
      draw();
      doc.restore();
    }
    return;
  }

  for (let i = 0; i < copies; i++) {
    if (i > 0) {
      doc.addPage({
        size:
          format === "A4"
            ? A4
            : format === "6x4"
              ? [LABEL_H, LABEL_W]
              : [LABEL_W, LABEL_H],
        margin: 0,
      });
    }
    doc.save();
    if (format === "A4") {
      doc.translate(28, 28);
    } else if (format === "6x4") {
      // Rotate the portrait label clockwise onto the landscape page.
      doc.translate(LABEL_H, 0).rotate(90);
    }
    draw();
    doc.restore();
  }
}

function firstPageSize(format) {
  if (format === "A4" || format === "A4_4") return A4;
  if (format === "6x4") return [LABEL_H, LABEL_W];
  return [LABEL_W, LABEL_H];
}

/**
 * Render the label to a PDF buffer.
 *
 * @param {Object} content - output of labelGenerationService.createLabelContent
 * @param {{format?: string, copies?: number}} options
 * @returns {Promise<Buffer>}
 */
async function renderShippingLabelPdf(content, options = {}) {
  const format = options.format || "4x6";
  const copies = Math.max(1, Math.min(10, Number(options.copies) || 1));
  const assets = await buildAssets(content);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: firstPageSize(format),
      margin: 0,
      info: {
        Title: `Shipping Label ${content.shipmentInfo.awbNumber || content.shipmentInfo.orderId}`,
        Author: content.brand.brandName || "Shipper",
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      layoutPages(doc, content, assets, format, copies);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  renderShippingLabelPdf,
  LABEL_W,
  LABEL_H,
};
