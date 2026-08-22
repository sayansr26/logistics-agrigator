/**
 * GST State Code Map
 *
 * Hardcoded India state/UT name -> 2-digit GST state code lookup, per the
 * official GSTIN state code list (Schedule to CGST Rules). State names in
 * this database are free text (captured from user-entered pickup/billing
 * addresses, not a controlled enum), so `resolveStateCode` normalizes case
 * and whitespace and also accepts a handful of common real-world variants
 * observed in the data (e.g. "DELHI" vs "Delhi", "NCT of Delhi").
 */

// Canonical India state/UT -> GST state code (all 28 states + 8 UTs).
const STATE_CODE_MAP = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "dadra and nagar haveli and daman and diu": "26",
  maharashtra: "27",
  "andhra pradesh": "28", // pre-bifurcation code, still used for legacy AP registrations
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  "andhra pradesh (new)": "37",
  ladakh: "38",

  // ---- Common real-world variants / aliases seen in free-text address data ----
  "nct of delhi": "07",
  "national capital territory of delhi": "07",
  "new delhi": "07",
  odisha_old_orissa: "21",
  orissa: "21",
  pondicherry: "34",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  "jammu & kashmir": "01",
  "andaman & nicobar islands": "35",
};

/**
 * Resolve a free-text India state/UT name to its 2-digit GST state code.
 *
 * @param {string} stateName
 * @returns {{ code: string|null, reason: string|null }}
 *   `code` is the 2-digit GST state code, or null if unmapped.
 *   `reason` explains why resolution failed (only set when code is null).
 */
function resolveStateCode(stateName) {
  if (!stateName || typeof stateName !== "string" || !stateName.trim()) {
    return { code: null, reason: "State name is empty or missing" };
  }

  const normalized = stateName.trim().toLowerCase().replace(/\s+/g, " ");
  const code = STATE_CODE_MAP[normalized];

  if (!code) {
    return {
      code: null,
      reason: `Unrecognized state name "${stateName}" - no GST state code mapping found`,
    };
  }

  return { code, reason: null };
}

module.exports = {
  STATE_CODE_MAP,
  resolveStateCode,
};
