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
  awbNumber: ["awb", "awbnumber", "awb_number", "waybill", "airwaybill", "tracking", "trackingid"],
  reportedAmount: ["amount", "reportedamount", "codamount", "cod", "collectedamount", "collected", "value"],
  collectionDate: ["date", "collectiondate", "collection_date", "codcollectiondate", "remittancedate"],
  courierReportId: ["reportid", "courierreportid", "referenceid", "reference", "utr"],
};

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
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
  if (lines.length === 0) return { rows: [], errors: [{ line: 0, error: "Empty file" }] };

  const headers = parseLine(lines[0]).map(normalizeHeader);

  // Build a column-index map for each canonical field
  const colIndex = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx !== -1) colIndex[field] = idx;
  }

  if (colIndex.awbNumber === undefined || colIndex.reportedAmount === undefined) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          error: "CSV must include an AWB column and an amount column (header row required)",
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
    const reportedAmount = parseFloat(String(amountRaw || "").replace(/[₹,\s]/g, ""));

    if (!awbNumber) {
      errors.push({ line: i + 1, error: "Missing AWB" });
      continue;
    }
    if (isNaN(reportedAmount)) {
      errors.push({ line: i + 1, error: `Invalid amount "${amountRaw}"` });
      continue;
    }

    const row = { awbNumber, reportedAmount };
    if (colIndex.collectionDate !== undefined && cells[colIndex.collectionDate]) {
      const d = new Date(cells[colIndex.collectionDate]);
      if (!isNaN(d.getTime())) row.collectionDate = d.toISOString();
    }
    if (colIndex.courierReportId !== undefined && cells[colIndex.courierReportId]) {
      row.courierReportId = cells[colIndex.courierReportId];
    }
    rows.push(row);
  }

  return { rows, errors };
}

module.exports = { parseCsvCollections };
