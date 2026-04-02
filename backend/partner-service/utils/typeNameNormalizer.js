/**
 * Canonical type-name normalization for ChargesType and PincodeType.
 *
 * Known operational names are mapped to a single uppercase canonical form
 * so that "COD", "cod", "Cod" all resolve to "COD".
 *
 * Names that don't match any known canonical are upper-cased as-is.
 */

const CANONICAL_MAP = {
  cod: "COD",
  prepaid: "PREPAID",
  fragile: "FRAGILE",
  frgile: "FRAGILE",
  insurance: "INSURANCE",
  reverse: "REVERSE",
  rto: "RTO",
  freight: "FREIGHT",
  handling: "HANDLING",
  fuel: "FUEL",
  oda: "ODA",
};

/**
 * Return the canonical semantic key for a type name.
 * E.g. "cod" → "COD", "FRGILE" → "FRAGILE", "My Custom" → "MY CUSTOM"
 *
 * @param {string} name
 * @returns {string} Canonical key (always uppercase / trimmed)
 */
function canonicalTypeName(name) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  return CANONICAL_MAP[lower] || trimmed.toUpperCase();
}

/**
 * Check whether a type name matches a known operational semantic.
 * Useful for conditional charge gating (COD, FRAGILE, etc.).
 *
 * @param {string} name - stored type name (any casing)
 * @param {string} semantic - canonical semantic to test, e.g. "COD"
 * @returns {boolean}
 */
function matchesSemantic(name, semantic) {
  if (!name) return false;
  return canonicalTypeName(name) === semantic;
}

module.exports = {
  canonicalTypeName,
  matchesSemantic,
  CANONICAL_MAP,
};
