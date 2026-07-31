/**
 * Bulk File Parser Service
 *
 * Parses uploaded CSV/Excel files into the nested shipment structure that
 * bulkProcessingService.processSingleShipment expects.
 *
 * The uploaded file is flat (one row per shipment, one column per field) but
 * the processing pipeline requires nested pickupAddress / deliveryAddress /
 * packageDetails objects, so this service owns that mapping.
 */

const XLSX = require("xlsx");
const logger = require("../shared/lib/logger");
const { ValidationError } = require("../shared/lib/errors");

/**
 * Canonical template columns, in display order.
 * This is the single source of truth for both the downloadable template and
 * the accepted header names.
 */
const TEMPLATE_COLUMNS = [
  "Order ID",
  "Pickup Name",
  "Pickup Phone",
  "Pickup Email",
  "Pickup Address Line 1",
  "Pickup Address Line 2",
  "Pickup Landmark",
  "Pickup City",
  "Pickup State",
  "Pickup Pincode",
  "Delivery Name",
  "Delivery Phone",
  "Delivery Email",
  "Delivery Address Line 1",
  "Delivery Address Line 2",
  "Delivery Landmark",
  "Delivery City",
  "Delivery State",
  "Delivery Pincode",
  "Weight (kg)",
  "Length (cm)",
  "Width (cm)",
  "Height (cm)",
  "Description",
  "Category",
  "Payment Type",
  "COD Amount",
  "Service Type",
  "Special Instructions",
];

/**
 * Example rows shipped with the template so users see the expected formats
 * (notably the +91-XXXXXXXXXX phone format, which is strictly validated).
 */
const TEMPLATE_SAMPLE_ROWS = [
  [
    "ORD-001",
    "Acme Warehouse",
    "+91-9876543210",
    "warehouse@acme.com",
    "Plot 12, MIDC Industrial Area",
    "",
    "Near Metro Station",
    "Mumbai",
    "Maharashtra",
    "400058",
    "John Doe",
    "+91-9876543211",
    "john@example.com",
    "123 Main Street",
    "Apartment 4B",
    "Opposite City Mall",
    "Delhi",
    "Delhi",
    "110001",
    "2.5",
    "30",
    "20",
    "15",
    "Electronics",
    "GENERAL",
    "PREPAID",
    "",
    "STANDARD",
    "Handle with care",
  ],
  [
    "ORD-002",
    "Acme Warehouse",
    "+91-9876543210",
    "warehouse@acme.com",
    "Plot 12, MIDC Industrial Area",
    "",
    "Near Metro Station",
    "Mumbai",
    "Maharashtra",
    "400058",
    "Jane Smith",
    "+91-9876543212",
    "jane@example.com",
    "456 Oak Avenue",
    "",
    "",
    "Bengaluru",
    "Karnataka",
    "560001",
    "1.0",
    "25",
    "15",
    "10",
    "Clothing",
    "GENERAL",
    "COD",
    "2000",
    "STANDARD",
    "",
  ],
];

/**
 * Normalise a header cell so lookups tolerate spacing/case/punctuation
 * differences between the template and what users actually upload.
 * "Weight (kg)" -> "weightkg", "Order ID" -> "orderid"
 */
function normaliseHeader(header) {
  return String(header || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Accepted header aliases per logical field. The first entry matches the
 * canonical template column; the rest cover common variations.
 */
const FIELD_ALIASES = {
  orderId: ["orderid", "orderno", "ordernumber", "referenceid"],

  pickupName: ["pickupname", "pickupcontactname", "sendername"],
  pickupPhone: [
    "pickupphone",
    "pickupcontactphone",
    "senderphone",
    "pickupmobile",
  ],
  pickupEmail: ["pickupemail", "senderemail"],
  pickupLine1: [
    "pickupaddressline1",
    "pickupaddress1",
    "pickupaddress",
    "pickupline1",
  ],
  pickupLine2: ["pickupaddressline2", "pickupaddress2", "pickupline2"],
  pickupLandmark: ["pickuplandmark"],
  pickupCity: ["pickupcity"],
  pickupState: ["pickupstate"],
  pickupPincode: ["pickuppincode", "pickuppin", "pickupzip", "pickuppostcode"],

  deliveryName: [
    "deliveryname",
    "customername",
    "receivername",
    "consigneename",
  ],
  deliveryPhone: [
    "deliveryphone",
    "customerphone",
    "receiverphone",
    "consigneephone",
    "phone",
    "mobile",
  ],
  deliveryEmail: ["deliveryemail", "customeremail", "receiveremail", "email"],
  deliveryLine1: [
    "deliveryaddressline1",
    "deliveryaddress1",
    "deliveryaddress",
    "deliveryline1",
    "address",
  ],
  deliveryLine2: ["deliveryaddressline2", "deliveryaddress2", "deliveryline2"],
  deliveryLandmark: ["deliverylandmark", "landmark"],
  deliveryCity: ["deliverycity", "city"],
  deliveryState: ["deliverystate", "state"],
  deliveryPincode: [
    "deliverypincode",
    "pincode",
    "pin",
    "zip",
    "postcode",
    "deliverypin",
  ],

  weight: ["weightkg", "weight"],
  length: ["lengthcm", "length"],
  width: ["widthcm", "width"],
  height: ["heightcm", "height"],
  description: ["description", "productdescription", "itemdescription"],
  category: ["category", "productcategory"],

  paymentType: ["paymenttype", "paymentmode", "payment"],
  codAmount: ["codamount", "cod", "collectableamount"],
  serviceType: ["servicetype", "service"],
  specialInstructions: ["specialinstructions", "instructions", "remarks"],
};

/**
 * Build a map of normalised-header -> logical field name for one file.
 */
function buildHeaderMap(headers) {
  const headerMap = {};

  headers.forEach((header) => {
    const normalised = normaliseHeader(header);
    if (!normalised) return;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalised)) {
        // First matching header wins, so template columns take precedence
        // over looser aliases when both are present.
        if (!Object.values(headerMap).includes(field)) {
          headerMap[header] = field;
        }
        break;
      }
    }
  });

  return headerMap;
}

/**
 * Convert a raw row keyed by original headers into one keyed by logical field.
 */
function mapRowToFields(row, headerMap) {
  const mapped = {};

  for (const [header, field] of Object.entries(headerMap)) {
    const value = row[header];
    if (value === undefined || value === null) continue;

    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed === "") continue;

    mapped[field] = trimmed;
  }

  return mapped;
}

/**
 * Normalise an Indian phone number to the +91-XXXXXXXXXX format required by
 * bulkProcessingService.validateAddress.
 *
 * Accepts 9876543210, 919876543210, +919876543210, 0-9876543210,
 * "+91 98765 43210" etc. Returns null when no valid 10-digit number is found,
 * so the caller can raise a row-level error rather than silently sending
 * something the validator will reject downstream.
 */
function normalisePhone(value) {
  if (value === undefined || value === null) return null;

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;

  // Strip the country code / trunk prefix to get the core subscriber number
  let local = digits;
  if (local.length > 10 && local.startsWith("91")) {
    local = local.slice(local.length - 10);
  } else if (local.length === 11 && local.startsWith("0")) {
    local = local.slice(1);
  }

  if (!/^[6-9][0-9]{9}$/.test(local)) return null;

  return `+91-${local}`;
}

/**
 * Normalise a pincode to a 6-digit string.
 * Excel commonly reads pincodes as numbers, dropping any leading zero, so
 * pad back to 6 digits before validation.
 */
function normalisePincode(value) {
  if (value === undefined || value === null) return null;

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;

  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}

/**
 * Parse a numeric cell, returning undefined when absent/unparseable.
 */
function parseNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalise payment type to the PREPAID/COD enum.
 */
function normalisePaymentType(value) {
  if (!value) return null;

  const normalised = String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (["PREPAID", "PRE", "PAID", "ONLINE"].includes(normalised)) {
    return "PREPAID";
  }
  if (["COD", "CASHONDELIVERY", "CASH"].includes(normalised)) {
    return "COD";
  }

  return null;
}

/**
 * Build the nested shipment object for a single mapped row.
 * Throws ValidationError with a row-scoped message on unrecoverable problems.
 */
function buildShipmentRecord(fields, rowNumber) {
  const missing = [];

  const orderId = fields.orderId ? String(fields.orderId).trim() : null;
  if (!orderId) missing.push("Order ID");

  // Phones are validated strictly downstream, so surface format problems here
  // where we can name the offending column and row.
  const pickupPhone = normalisePhone(fields.pickupPhone);
  if (!pickupPhone) {
    if (!fields.pickupPhone) {
      missing.push("Pickup Phone");
    } else {
      throw new ValidationError(
        `Row ${rowNumber}: invalid Pickup Phone "${fields.pickupPhone}". Expected a 10-digit Indian mobile number.`,
      );
    }
  }

  const deliveryPhone = normalisePhone(fields.deliveryPhone);
  if (!deliveryPhone) {
    if (!fields.deliveryPhone) {
      missing.push("Delivery Phone");
    } else {
      throw new ValidationError(
        `Row ${rowNumber}: invalid Delivery Phone "${fields.deliveryPhone}". Expected a 10-digit Indian mobile number.`,
      );
    }
  }

  const paymentType = normalisePaymentType(fields.paymentType);
  if (!paymentType) {
    if (!fields.paymentType) {
      missing.push("Payment Type");
    } else {
      throw new ValidationError(
        `Row ${rowNumber}: invalid Payment Type "${fields.paymentType}". Expected PREPAID or COD.`,
      );
    }
  }

  const weight = parseNumber(fields.weight);
  if (weight === undefined) missing.push("Weight (kg)");

  const requiredText = {
    "Pickup Name": fields.pickupName,
    "Pickup Address Line 1": fields.pickupLine1,
    "Pickup City": fields.pickupCity,
    "Pickup State": fields.pickupState,
    "Pickup Pincode": fields.pickupPincode,
    "Delivery Name": fields.deliveryName,
    "Delivery Address Line 1": fields.deliveryLine1,
    "Delivery City": fields.deliveryCity,
    "Delivery State": fields.deliveryState,
    "Delivery Pincode": fields.deliveryPincode,
  };

  for (const [label, value] of Object.entries(requiredText)) {
    if (!value) missing.push(label);
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Row ${rowNumber}: missing required ${missing.length === 1 ? "column" : "columns"}: ${missing.join(", ")}`,
    );
  }

  const codAmount = parseNumber(fields.codAmount);
  if (paymentType === "COD" && (codAmount === undefined || codAmount <= 0)) {
    throw new ValidationError(
      `Row ${rowNumber}: COD Amount is required and must be greater than 0 for COD shipments.`,
    );
  }

  return {
    orderId,
    paymentType,
    codAmount: paymentType === "COD" ? codAmount : undefined,
    serviceType: fields.serviceType
      ? String(fields.serviceType).trim().toUpperCase()
      : "STANDARD",
    specialInstructions: fields.specialInstructions,

    pickupAddress: {
      name: String(fields.pickupName).trim(),
      phone: pickupPhone,
      email: fields.pickupEmail,
      line1: String(fields.pickupLine1).trim(),
      line2: fields.pickupLine2,
      landmark: fields.pickupLandmark,
      city: String(fields.pickupCity).trim(),
      state: String(fields.pickupState).trim(),
      pincode: normalisePincode(fields.pickupPincode),
      country: "India",
    },

    deliveryAddress: {
      name: String(fields.deliveryName).trim(),
      phone: deliveryPhone,
      email: fields.deliveryEmail,
      line1: String(fields.deliveryLine1).trim(),
      line2: fields.deliveryLine2,
      landmark: fields.deliveryLandmark,
      city: String(fields.deliveryCity).trim(),
      state: String(fields.deliveryState).trim(),
      pincode: normalisePincode(fields.deliveryPincode),
      country: "India",
    },

    packageDetails: {
      weight,
      length: parseNumber(fields.length),
      width: parseNumber(fields.width),
      height: parseNumber(fields.height),
      description: fields.description,
      category: fields.category
        ? String(fields.category).trim().toUpperCase()
        : "GENERAL",
    },
  };
}

class BulkFileParserService {
  /**
   * Parse an uploaded CSV/Excel buffer into shipment records.
   *
   * Row-level problems are collected into parseErrors rather than aborting the
   * whole file, so a single bad row does not reject a 500-row upload.
   *
   * @param {Buffer} buffer - raw uploaded file contents
   * @param {string} originalName - original filename (used for logging)
   * @returns {{rows: Array<object>, parseErrors: Array<{row: number, orderId: string|null, error: string}>, totalRows: number}}
   */
  parseShipmentFile(buffer, originalName = "upload") {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError("Uploaded file is empty");
    }

    let workbook;
    try {
      // cellDates keeps date cells readable; XLSX handles CSV and XLSX alike.
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch (error) {
      throw new ValidationError(
        `Unable to read file: ${error.message}. Ensure it is a valid CSV or Excel file.`,
      );
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new ValidationError("The uploaded file contains no sheets");
    }

    const sheet = workbook.Sheets[sheetName];

    // defval:null keeps empty cells addressable so header mapping stays aligned
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false,
      blankrows: false,
    });

    if (rawRows.length === 0) {
      throw new ValidationError(
        "The uploaded file contains no data rows. Download the template for the expected format.",
      );
    }

    const headers = Object.keys(rawRows[0]);
    const headerMap = buildHeaderMap(headers);
    const recognisedFields = Object.values(headerMap);

    // Fail fast on a completely unrecognised file rather than emitting one
    // error per row.
    if (!recognisedFields.includes("orderId")) {
      throw new ValidationError(
        `Could not find an "Order ID" column in the uploaded file. Download the template for the expected format.`,
      );
    }

    const rows = [];
    const parseErrors = [];

    rawRows.forEach((rawRow, index) => {
      // +2 accounts for the header row and 1-based spreadsheet numbering,
      // so the number matches what the user sees in Excel.
      const rowNumber = index + 2;

      const fields = mapRowToFields(rawRow, headerMap);

      // Skip rows that are entirely blank
      if (Object.keys(fields).length === 0) return;

      try {
        rows.push(buildShipmentRecord(fields, rowNumber));
      } catch (error) {
        parseErrors.push({
          row: rowNumber,
          orderId: fields.orderId ? String(fields.orderId) : null,
          error: error.message,
        });
      }
    });

    logger.info("Parsed bulk shipment file", {
      service: "shipment-service",
      function: "parseShipmentFile",
      fileName: originalName,
      totalRows: rawRows.length,
      validRows: rows.length,
      errorRows: parseErrors.length,
    });

    if (rows.length === 0) {
      throw new ValidationError(
        `No valid shipment rows found in the file. ${
          parseErrors.length > 0
            ? `First error: ${parseErrors[0].error}`
            : "Download the template for the expected format."
        }`,
      );
    }

    return {
      rows,
      parseErrors,
      totalRows: rawRows.length,
    };
  }

  /**
   * Generate the CSV template from the same column definitions the parser
   * accepts, so the template can never drift from what is parseable.
   */
  generateTemplateCsv() {
    const escapeCell = (cell) => {
      const value = String(cell ?? "");
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    };

    const lines = [
      TEMPLATE_COLUMNS.map(escapeCell).join(","),
      ...TEMPLATE_SAMPLE_ROWS.map((row) => row.map(escapeCell).join(",")),
    ];

    return `${lines.join("\n")}\n`;
  }
}

module.exports = new BulkFileParserService();
module.exports.TEMPLATE_COLUMNS = TEMPLATE_COLUMNS;
