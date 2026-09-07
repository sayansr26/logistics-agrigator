/**
 * Build Merged Pincode CSV  (India Post  ⨝  GeoNames coordinates)
 *
 * Produces data/merged_pincode_data.csv — the single file the DB importer
 * (scripts/import-pincode-data.js) consumes.
 *
 * Strategy (ZERO DATA LOSS):
 *   • Base   = data/india_post_raw.csv  (authoritative — every post office row,
 *              NO de-duplication, real state / district / taluk / office type)
 *   • Coords = data/IN.txt (GeoNames)   left-joined on the 6-digit PINCODE.
 *              GeoNames covers ~all of India's ~19k pincodes, so effectively
 *              every office row receives PIN-level lat/lng.
 *   • State names are normalised to a canonical Title-Case form so the two
 *              sources don't create duplicate states.
 *
 * Output columns (header kept identical to what the importer already reads):
 *   pincode, area, lat, lng, district, state, type
 *     - area     <- cleaned officename          (importer -> Area)
 *     - district <- districtname                (importer -> City)
 *     - state    <- normalised statename        (importer -> State)
 *     - type     <- officetype (S.O / B.O / H.O / ...)
 *
 * Usage:
 *   node scripts/build-merged-pincodes.js
 *   yarn build:pincodes
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

let logger;
try {
  logger = require("../shared/lib/logger");
} catch {
  logger = console;
}

const DATA_DIR = path.join(__dirname, "../data");
const INDIA_POST_CSV = path.join(DATA_DIR, "india_post_raw.csv");
const GEONAMES_TXT = path.join(DATA_DIR, "IN.txt");
const OUTPUT_CSV = path.join(DATA_DIR, "merged_pincode_data.csv");

const OUTPUT_COLUMNS = [
  "pincode",
  "area",
  "lat",
  "lng",
  "district",
  "state",
  "type",
];

/**
 * Canonical state-name map. Keys are UPPERCASE, punctuation-normalised
 * ("&" -> "AND", collapsed spaces). Value is the canonical display name.
 * Covers spelling drift between India Post (UPPERCASE, "&") and GeoNames.
 */
const STATE_CANONICAL = {
  "ANDAMAN AND NICOBAR ISLANDS": "Andaman & Nicobar Islands",
  "ANDHRA PRADESH": "Andhra Pradesh",
  "ARUNACHAL PRADESH": "Arunachal Pradesh",
  ASSAM: "Assam",
  BIHAR: "Bihar",
  CHANDIGARH: "Chandigarh",
  CHATTISGARH: "Chhattisgarh",
  CHHATTISGARH: "Chhattisgarh",
  "DADRA AND NAGAR HAVELI": "Dadra and Nagar Haveli and Daman and Diu",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU":
    "Dadra and Nagar Haveli and Daman and Diu",
  "DAMAN AND DIU": "Dadra and Nagar Haveli and Daman and Diu",
  DELHI: "Delhi",
  GOA: "Goa",
  GUJARAT: "Gujarat",
  HARYANA: "Haryana",
  "HIMACHAL PRADESH": "Himachal Pradesh",
  "JAMMU AND KASHMIR": "Jammu & Kashmir",
  JHARKHAND: "Jharkhand",
  KARNATAKA: "Karnataka",
  KERALA: "Kerala",
  LADAKH: "Ladakh",
  LAKSHADWEEP: "Lakshadweep",
  "MADHYA PRADESH": "Madhya Pradesh",
  MAHARASHTRA: "Maharashtra",
  MANIPUR: "Manipur",
  MEGHALAYA: "Meghalaya",
  MIZORAM: "Mizoram",
  NAGALAND: "Nagaland",
  ODISHA: "Odisha",
  ORISSA: "Odisha",
  PONDICHERRY: "Puducherry",
  PUDUCHERRY: "Puducherry",
  PUNJAB: "Punjab",
  RAJASTHAN: "Rajasthan",
  SIKKIM: "Sikkim",
  "TAMIL NADU": "Tamil Nadu",
  TELANGANA: "Telangana",
  TRIPURA: "Tripura",
  "UTTAR PRADESH": "Uttar Pradesh",
  UTTARAKHAND: "Uttarakhand",
  UTTARANCHAL: "Uttarakhand",
  "WEST BENGAL": "West Bengal",
};

function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Normalise a state name from either source to its canonical display form.
 */
function canonicalState(raw) {
  if (!raw) return "";
  const key = raw
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return STATE_CANONICAL[key] || titleCase(raw);
}

/**
 * Clean an India Post office name into a human area/locality label.
 * "Chakragaon S.O" -> "Chakragaon", "New Delhi G.P.O." -> "New Delhi".
 */
function cleanOfficeName(name) {
  if (!name) return "";
  return name
    .replace(/\s+(B\.?O|S\.?O|H\.?O|G\.?P\.?O|P\.?O|E\.?D\.?S\.?O)\.?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Very small CSV line parser that honours quoted fields ("a,b").
 */
function parseCsvLine(line) {
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
  return out;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Load GeoNames PIN -> {lat,lng}. Keeps the first coordinate seen per PIN
 * (PIN-area centroid). GeoNames IN.txt is tab-separated:
 *   [1]=postalcode [9]=lat [10]=lng
 */
async function loadGeonamesCoords() {
  const coords = new Map();
  const rl = readline.createInterface({
    input: fs.createReadStream(GEONAMES_TXT),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    const cols = line.split("\t");
    const pin = (cols[1] || "").trim();
    const lat = cols[9];
    const lng = cols[10];
    if (pin && !coords.has(pin) && lat && lng) {
      coords.set(pin, { lat, lng });
    }
  }
  return coords;
}

async function main() {
  console.log("🏁 Building merged pincode CSV (India Post ⨝ GeoNames)");
  console.log("=".repeat(55));

  if (!fs.existsSync(INDIA_POST_CSV)) {
    console.error(`❌ Missing ${INDIA_POST_CSV}`);
    console.error("   Run the fetch first:  yarn fetch:india-post");
    process.exit(1);
  }
  if (!fs.existsSync(GEONAMES_TXT)) {
    console.error(`❌ Missing ${GEONAMES_TXT} (GeoNames coordinates source)`);
    process.exit(1);
  }

  console.log("📂 Loading GeoNames coordinates...");
  const coords = await loadGeonamesCoords();
  console.log(`   PIN coordinates loaded: ${coords.size.toLocaleString()}`);

  const out = fs.createWriteStream(OUTPUT_CSV, { encoding: "utf-8" });
  out.write(OUTPUT_COLUMNS.join(",") + "\n");

  const rl = readline.createInterface({
    input: fs.createReadStream(INDIA_POST_CSV),
    crlfDelay: Infinity,
  });

  let header = null;
  const idx = {};
  let rows = 0;
  let withCoords = 0;
  let skipped = 0;
  const states = new Set();
  const pins = new Set();

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      header.forEach((h, i) => (idx[h.trim()] = i));
      continue;
    }
    const cols = parseCsvLine(line);
    const pincode = (cols[idx.pincode] || "").trim();
    if (!pincode || pincode.length < 6) {
      skipped++;
      continue;
    }

    const area = cleanOfficeName(cols[idx.officename] || "");
    const state = canonicalState(cols[idx.statename] || "");
    const district = titleCase(cols[idx.districtname] || "");
    const type = (cols[idx.officetype] || "").trim() || "unknown";
    const c = coords.get(pincode);
    if (c) withCoords++;

    out.write(
      [
        pincode,
        csvEscape(area),
        c ? c.lat : "",
        c ? c.lng : "",
        csvEscape(district),
        csvEscape(state),
        csvEscape(type),
      ].join(",") + "\n",
    );

    rows++;
    states.add(state);
    pins.add(pincode);
  }

  await new Promise((resolve) => out.end(resolve));

  const pct = rows ? Math.round((withCoords / rows) * 100) : 0;
  console.log("\n✅ Merged CSV written");
  console.log(`   File             : ${OUTPUT_CSV}`);
  console.log(`   Rows (areas)     : ${rows.toLocaleString()}`);
  console.log(`   Unique pincodes  : ${pins.size.toLocaleString()}`);
  console.log(`   Unique states    : ${states.size}`);
  console.log(`   Rows with coords : ${withCoords.toLocaleString()} (${pct}%)`);
  if (skipped) console.log(`   Skipped (bad PIN): ${skipped.toLocaleString()}`);
  console.log("\n🎉 Done. Import with:  yarn import:pincodes");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Merge failed:", err);
    console.error("❌ Merge failed:", err.message);
    process.exit(1);
  });
}

module.exports = { main, canonicalState, cleanOfficeName, OUTPUT_CSV };
