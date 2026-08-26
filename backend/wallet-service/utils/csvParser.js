/**
 * Dependency-free CSV parser for courier COD reports.
 *
 * Handles quoted fields, commas inside quotes, and CRLF/LF line endings.
 * Maps flexible header names to canonical collection fields so a variety of
 * courier report layouts can be imported without configuration.
 *
 * (Binary .xlsx import would require the `exceljs` dependency + an image rebuild;
 * this text/CSV path needs no new dependencies.)
 */

// Header aliases → canonical field
const FIELD_ALIASES = {
  awbNumber: [
    "awb",
    "awbnumber",
    "awb_number",
    "waybill",
    "airwaybill",
    "tracking",
    "trackingid",
  ],
  reportedAmount: [
    "amount",
    "reportedamount",
    "codamount",
    "cod",
    "collectedamount",
    "collected",
    "value",
  ],
  collectionDate: [
    "date",
    "collectiondate",
    "collection_date",
    "codcollectiondate",
    "remittancedate",
  ],
  courierReportId: [
    "reportid",
    "courierreportid",
    "referenceid",
    "reference",
    "utr",
  ],
};

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/** Parse a single CSV line respecting quotes. */
function parseLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse CSV text into collection rows.
 * @param {string} csvText
 * @returns {{ rows: Array, errors: Array<{line:number, error:string}> }}
 */
function parseCsvCollections(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length === 0)
    return { rows: [], errors: [{ line: 0, error: "Empty file" }] };

  const headers = parseLine(lines[0]).map(normalizeHeader);

  // Build a column-index map for each canonical field
  const colIndex = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx !== -1) colIndex[field] = idx;
  }

  if (
    colIndex.awbNumber === undefined ||
    colIndex.reportedAmount === undefined
  ) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          error:
            "CSV must include an AWB column and an amount column (header row required)",
        },
      ],
    };
  }

  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const awbNumber = cells[colIndex.awbNumber];
    const amountRaw = cells[colIndex.reportedAmount];
    const reportedAmount = parseFloat(
      String(amountRaw || "").replace(/[₹,\s]/g, ""),
    );

    if (!awbNumber) {
      errors.push({ line: i + 1, error: "Missing AWB" });
      continue;
    }
    if (isNaN(reportedAmount)) {
      errors.push({ line: i + 1, error: `Invalid amount "${amountRaw}"` });
      continue;
    }

    const row = { awbNumber, reportedAmount };
    if (
      colIndex.collectionDate !== undefined &&
      cells[colIndex.collectionDate]
    ) {
      const d = new Date(cells[colIndex.collectionDate]);
      if (!isNaN(d.getTime())) row.collectionDate = d.toISOString();
    }
    if (
      colIndex.courierReportId !== undefined &&
      cells[colIndex.courierReportId]
    ) {
      row.courierReportId = cells[colIndex.courierReportId];
    }
    rows.push(row);
  }

  return { rows, errors };
}

/* ------------------------------------------------------------------------- *
 * UPI / QR settlement files
 *
 * A SEPARATE alias table from FIELD_ALIASES above. Do not merge the two: the
 * COD importer in production relies on "utr" resolving to `courierReportId`,
 * while a UPI settlement file's "utr" is the payment's own bank reference and
 * must resolve to `utr`. Same header word, two different canonical fields —
 * hence two tables.
 * ------------------------------------------------------------------------- */

// Header aliases → canonical QR-collection field
const QR_FIELD_ALIASES = {
  utr: [
    "utr",
    "rrn",
    "utrno",
    "utrnumber",
    "bankrrn",
    "referenceno",
    "refno",
    "upitransactionid",
    "upitxnid",
  ],
  // NOTE: the file carries RUPEES; we emit paise (see parseRupeesToPaise).
  amountPaise: [
    "amount",
    "amt",
    "credit",
    "creditamount",
    "transactionamount",
    "value",
  ],
  qrIdentifier: [
    "qrid",
    "qrcode",
    "storeid",
    "submerchantid",
    "merchantstoreid",
    "terminalid",
    "subid",
    "storecode",
  ],
  payerVpa: ["vpa", "payervpa", "customervpa", "upiid", "payerupi"],
  payerName: ["payername", "customername", "remittername", "name"],
  txnAt: [
    "date",
    "txndate",
    "transactiondate",
    "valuedate",
    "paymentdate",
    "datetime",
    "timestamp",
  ],
  providerTxnId: [
    "orderid",
    "trackingid",
    "transactionid",
    "ccavenuereferenceno",
    "bankrefno",
    "referencenumber",
  ],
};

/**
 * Rupee string → integer paise, or null if it is not an exact rupee amount.
 *
 * DELIBERATE DUPLICATION: `services/payments/ccavenueCrypto.js` exports a
 * `parseAmountToPaise` with exactly these semantics. It is NOT imported here
 * because this module is dependency-free by design (no requires at all), and
 * pulling in a crypto module would drag the whole payments tree into the CSV
 * import path. Keep the two in sync if either changes.
 *
 * Semantics (matched to ccavenueCrypto.parseAmountToPaise):
 *  - decimal string arithmetic only. NEVER parseFloat(x) * 100:
 *    parseFloat("1499.99") * 100 === 149998.99999999999, which would later fail
 *    the paise-exact amount check in the credit path and park a good payment.
 *  - a leading "-" is intentionally not matched: negative amounts are nonsense.
 *  - more than 2 decimal places does not match: we cannot invent a paise value,
 *    so the caller turns it into a row error rather than silently rounding.
 * @param {string|number} amountString
 * @returns {number|null} integer paise, or null when unparseable
 */
function parseRupeesToPaise(amountString) {
  let text;

  if (typeof amountString === "number") {
    if (!Number.isFinite(amountString) || amountString < 0) return null;
    text = String(amountString);
  } else if (typeof amountString === "string") {
    text = amountString.trim();
  } else {
    return null;
  }

  // Same cleaning the COD parser applies: strip ₹, thousands separators, spaces.
  text = text.replace(/[₹,\s]/g, "");
  if (text.length === 0) return null;

  const match = /^\+?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;

  const rupees = Number(match[1]);
  const fraction = (match[2] || "").padEnd(2, "0");
  const total = rupees * 100 + Number(fraction);

  if (!Number.isSafeInteger(total)) return null;

  return total;
}

/**
 * Permissive timestamp parsing for Indian bank / PSP settlement files.
 *
 * DAY-FIRST is deliberate for ambiguous separated dates: "01/02/2026" is read as
 * 1 Feb 2026, not 1 Jan 2026, because these files are Indian (DD/MM/YYYY is the
 * local convention) and JS's own `new Date("01/02/2026")` would read it US-style.
 * Unrecognised input returns null — the caller treats that as metadata loss, not
 * a row error: refusing a whole payment row over a date format would be wrong.
 * @param {string} value
 * @returns {Date|null}
 */
function parseQrTxnAt(value) {
  const text = String(
    value === null || value === undefined ? "" : value,
  ).trim();
  if (text === "") return null;

  // DD/MM/YYYY or DD-MM-YYYY (optionally with HH:mm[:ss]) — day-first.
  let m =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      text,
    );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(
      year,
      month - 1,
      day,
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
    );
    // Reject rollovers such as 31/02/2026.
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    )
      return null;
    return d;
  }

  // YYYY-MM-DD [HH:mm[:ss]] (space separator is not valid ISO in every engine).
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    text,
  );
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(
      year,
      month - 1,
      day,
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
    );
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    )
      return null;
    return d;
  }

  // Full ISO-8601 (with offset / Z / milliseconds) and anything else the engine
  // recognises unambiguously.
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
}

function cellAt(cells, idx) {
  if (idx === undefined) return "";
  const v = cells[idx];
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * Parse a UPI/QR settlement CSV into rows shaped for
 * `qrCollectionService.ingestCollection`.
 *
 * Whole-file failure (single line-1 error, mirroring the COD parser's missing-AWB
 * behaviour) when the header lacks an amount column, or lacks BOTH `utr` and
 * `qrIdentifier`: a file we can neither key nor attribute is not partially usable.
 * Per-row problems accumulate in `errors[]` with the 1-based file line number and
 * never abort the batch — one malformed row must not cost the operator the rest.
 *
 * @param {string} csvText
 * @returns {{rows: Array<Object>, errors: Array<{line:number, error:string}>}}
 */
function parseCsvQrCollections(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length === 0)
    return { rows: [], errors: [{ line: 0, error: "Empty file" }] };

  const headers = parseLine(lines[0]).map(normalizeHeader);

  const colIndex = {};
  for (const [field, aliases] of Object.entries(QR_FIELD_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx !== -1) colIndex[field] = idx;
  }

  if (colIndex.amountPaise === undefined) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          error: "CSV must include an amount column (header row required)",
        },
      ],
    };
  }
  if (colIndex.utr === undefined && colIndex.qrIdentifier === undefined) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          error:
            "CSV must include a UTR column or a QR identifier column (header row required)",
        },
      ],
    };
  }

  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const cells = parseLine(lines[i]);

    const amountRaw = cellAt(cells, colIndex.amountPaise);
    if (amountRaw === "") {
      errors.push({ line: lineNo, error: "Missing amount" });
      continue;
    }

    // A leading "-" never matches, so negatives land here as "Invalid amount".
    const amountPaise = parseRupeesToPaise(amountRaw);
    if (amountPaise === null) {
      errors.push({
        line: lineNo,
        error: `Invalid amount "${amountRaw}" (expected rupees with at most 2 decimal places)`,
      });
      continue;
    }
    if (amountPaise <= 0) {
      errors.push({
        line: lineNo,
        error: `Amount must be greater than zero (got "${amountRaw}")`,
      });
      continue;
    }

    const utrRaw = cellAt(cells, colIndex.utr);
    const utr = utrRaw === "" ? null : utrRaw.toUpperCase();
    const qrIdentifierRaw = cellAt(cells, colIndex.qrIdentifier);
    const qrIdentifier = qrIdentifierRaw === "" ? null : qrIdentifierRaw;

    if (utr === null && qrIdentifier === null) {
      errors.push({
        line: lineNo,
        error: "Row has neither a UTR nor a QR identifier",
      });
      continue;
    }

    const payerVpaRaw = cellAt(cells, colIndex.payerVpa);
    const payerNameRaw = cellAt(cells, colIndex.payerName);
    const providerTxnIdRaw = cellAt(cells, colIndex.providerTxnId);

    // Exactly the shape ingestCollection expects: these seven keys, no extras, never undefined.
    rows.push({
      utr,
      amountPaise,
      qrIdentifier,
      payerVpa: payerVpaRaw === "" ? null : payerVpaRaw,
      payerName: payerNameRaw === "" ? null : payerNameRaw,
      txnAt: parseQrTxnAt(cellAt(cells, colIndex.txnAt)),
      providerTxnId: providerTxnIdRaw === "" ? null : providerTxnIdRaw,
    });
  }

  return { rows, errors };
}

module.exports = {
  parseCsvCollections,
  parseCsvQrCollections,
  QR_FIELD_ALIASES,
};
