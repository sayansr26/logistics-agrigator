/**
 * Fetch India Post Pincode Directory (LIVE from data.gov.in)
 *
 * Pulls the complete "All India Pincode Directory" from the official
 * Open Government Data (OGD) Platform and writes a LOCAL snapshot CSV so
 * the DB import never has to hit the network again.
 *
 *   Source : https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month
 *   Records: ~155,570 post-office rows (~19k unique pincodes)
 *   Fields : officename, pincode, officetype, deliverystatus, divisionname,
 *            regionname, circlename, taluk, districtname, statename
 *   (Note  : the source has NO latitude/longitude — those are merged in later
 *            from GeoNames IN.txt by build-merged-pincodes.js)
 *
 * Output: data/india_post_raw.csv
 *
 * Usage:
 *   DATA_GOV_API_KEY=xxxx node scripts/fetch-india-post.js
 *   yarn fetch:india-post
 *
 * The API key MUST come from the environment (never hardcode / commit it).
 * Get a free key at https://data.gov.in/ -> "My Account" -> "API Key".
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

// shared/ lives at the repo root and is mounted to /app/shared inside the
// service container. Fall back to console when running on the host where that
// path may not resolve, so this data-tooling script works in both contexts.
let logger;
try {
  logger = require("../shared/lib/logger");
} catch {
  logger = console;
}

const API_KEY = process.env.DATA_GOV_API_KEY;
const RESOURCE_ID =
  process.env.DATA_GOV_PINCODE_RESOURCE ||
  "6176ee09-3d56-4a3b-8115-21841576b2f6";

const DATA_DIR = path.join(__dirname, "../data");
const OUTPUT_CSV = path.join(DATA_DIR, "india_post_raw.csv");

const PAGE_SIZE = 1000; // max the API returns per request
const MAX_RETRIES = 8;
const BASE_BACKOFF_MS = 3000;
const INTER_PAGE_DELAY_MS = 700; // polite throttle to avoid HTTP 429
const RATE_LIMIT_BACKOFF_MS = 15000; // extra wait when the API returns 429

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Columns we persist, in a stable order. This IS the CSV header.
const COLUMNS = [
  "pincode",
  "officename",
  "officetype",
  "deliverystatus",
  "taluk",
  "districtname",
  "statename",
  "divisionname",
  "regionname",
  "circlename",
];

/**
 * Escape a value for CSV (quote if it contains comma / quote / newline).
 */
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a single API page URL.
 */
function pageUrl(offset) {
  const params = new URLSearchParams({
    "api-key": API_KEY,
    format: "json",
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  return `https://api.data.gov.in/resource/${RESOURCE_ID}?${params.toString()}`;
}

/**
 * Fetch one page with retry + exponential backoff.
 * Uses the global fetch (Node 18+).
 */
async function fetchPage(offset) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const res = await fetch(pageUrl(offset), { signal: controller.signal });
      clearTimeout(timeout);

      if (res.status === 429) {
        throw Object.assign(new Error("HTTP 429 Too Many Requests"), {
          rateLimited: true,
        });
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      if (json.status && json.status !== "ok") {
        throw new Error(`API status: ${json.status} — ${json.message || ""}`);
      }
      return json;
    } catch (err) {
      lastError = err;
      // On 429, back off much harder and grow with each attempt.
      const wait = err.rateLimited
        ? RATE_LIMIT_BACKOFF_MS * (attempt + 1)
        : BASE_BACKOFF_MS * (attempt + 1);
      logger.warn(
        `Page @${offset} attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err.message}. Retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw new Error(
    `Failed to fetch page @${offset} after ${MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}

async function main() {
  console.log("🏁 Fetching India Post Pincode Directory (data.gov.in)");
  console.log("=".repeat(55));

  if (!API_KEY) {
    console.error(
      "❌ DATA_GOV_API_KEY is not set. Add it to backend/partner-service/.env",
    );
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Prime the first page to learn the total.
  console.log("🔎 Probing dataset size...");
  const first = await fetchPage(0);
  const total = parseInt(first.total, 10);
  console.log(`📦 Total records reported by API: ${total.toLocaleString()}`);

  const out = fs.createWriteStream(OUTPUT_CSV, { encoding: "utf-8" });
  out.write(COLUMNS.join(",") + "\n");

  const seenPincodes = new Set();
  let written = 0;

  const writeRecords = (records) => {
    for (const rec of records) {
      const row = COLUMNS.map((c) => csvEscape(rec[c])).join(",");
      out.write(row + "\n");
      written++;
      if (rec.pincode) seenPincodes.add(String(rec.pincode).trim());
    }
  };

  writeRecords(first.records || []);

  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    await sleep(INTER_PAGE_DELAY_MS); // throttle to stay under the rate limit
    const page = await fetchPage(offset);
    const records = page.records || [];
    if (records.length === 0) break;
    writeRecords(records);

    if (offset % 20000 === 0 || offset + PAGE_SIZE >= total) {
      const pct = Math.min(100, Math.round((written / total) * 100));
      console.log(
        `   ⏳ ${written.toLocaleString()}/${total.toLocaleString()} (${pct}%)`,
      );
    }
  }

  await new Promise((resolve) => out.end(resolve));

  console.log("\n✅ Snapshot written");
  console.log(`   File            : ${OUTPUT_CSV}`);
  console.log(`   Office rows      : ${written.toLocaleString()}`);
  console.log(`   Unique pincodes  : ${seenPincodes.size.toLocaleString()}`);

  if (written < total * 0.99) {
    console.warn(
      `\n⚠️  Wrote ${written} of ${total} expected rows — snapshot may be incomplete.`,
    );
    process.exit(1);
  }

  console.log("\n🎉 Done. Next: build the merged CSV with:");
  console.log("   yarn build:pincodes");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("India Post fetch failed:", err);
    console.error("❌ Fetch failed:", err.message);
    process.exit(1);
  });
}

module.exports = { main, OUTPUT_CSV, COLUMNS };
