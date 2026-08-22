/**
 * Booking field diagnostics
 *
 * Couriers reject a booking with one opaque sentence — Delhivery's is
 * "Crashing while saving package due to exception suspicious order/consignee",
 * err_code ER0005 — which names no field and gives the operator nothing to act
 * on. This module inspects the data we are about to send (or just sent) and
 * reports WHICH fields are likely responsible, so the UI can offer to edit
 * exactly those and retry instead of showing a dead-end error string.
 *
 * These are heuristics, deliberately conservative: every rule below reflects
 * data a real consignment would not carry. They are advisory — `blocking` marks
 * the ones worth stopping a courier call for.
 */

/**
 * Numbers that are obviously not a real subscriber: all-same digits, a straight
 * ascending/descending run, or the 98765432xx / 12345678xx families that are
 * the de-facto placeholders in Indian test data. Couriers blacklist these, and
 * a blacklisted consignee number is a prime trigger for Delhivery's
 * "suspicious order/consignee" rejection.
 */
function isPlaceholderPhone(digits) {
  if (/^(\d)\1{9}$/.test(digits)) return true;

  const asc = "01234567890123456789";
  const desc = "98765432109876543210";
  if (asc.includes(digits) || desc.includes(digits)) return true;

  // The first eight digits being a pure run is enough — only the tail varies
  // across the usual 9876543210/9876543211/9876543219 placeholders.
  const head = digits.slice(0, 8);
  return asc.includes(head) || desc.includes(head);
}

/** Words that read as scaffolding rather than a real name/address/product. */
// Anchored at a word start but open-ended at the end, so "testq" and "testing"
// match while real words that merely contain them ("latest", "contest") do not.
const TEST_WORDS =
  /\b(test|demo|dummy|sample|asdf|qwerty|abcd|xxx)\w*|\b(na|n\/a)\b/i;

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * @param {string} field - dot path the UI can map to an editable input
 * @param {string} label - human label for that input
 */
function issue(field, label, value, reason, fix, blocking = true) {
  return { field, label, value: value ?? null, reason, fix, blocking };
}

function checkPhone(field, label, value, issues) {
  const digits = normalizeDigits(value);

  if (!digits) {
    issues.push(
      issue(
        field,
        label,
        value,
        "No phone number is set.",
        "Add a 10-digit Indian mobile number.",
      ),
    );
    return;
  }
  // A leading 91/0 is stripped before sending, so judge the last 10 digits.
  const local = digits.length > 10 ? digits.slice(-10) : digits;

  if (local.length !== 10) {
    issues.push(
      issue(
        field,
        label,
        value,
        `Reads as ${local.length} digits — couriers require exactly 10.`,
        "Enter a 10-digit Indian mobile number.",
      ),
    );
    return;
  }
  if (!/^[6-9]/.test(local)) {
    issues.push(
      issue(
        field,
        label,
        value,
        "Indian mobile numbers start with 6, 7, 8 or 9.",
        "Enter a valid 10-digit mobile number.",
      ),
    );
    return;
  }
  if (isPlaceholderPhone(local)) {
    issues.push(
      issue(
        field,
        label,
        value,
        "This is a placeholder sequence couriers flag as a suspicious consignee.",
        "Enter the recipient's real mobile number.",
      ),
    );
  }
}

function checkAddress(field, label, value, issues) {
  const text = String(value || "").trim();

  if (!text) {
    issues.push(
      issue(
        field,
        label,
        value,
        "No address line is set.",
        "Add the street address.",
      ),
    );
    return;
  }
  if (text.length < 10) {
    issues.push(
      issue(
        field,
        label,
        value,
        `Only ${text.length} characters — too short to deliver to.`,
        "Enter the full street address, including house or building number.",
      ),
    );
    return;
  }
  if (TEST_WORDS.test(text)) {
    issues.push(
      issue(
        field,
        label,
        value,
        "Contains placeholder text couriers reject as a suspicious consignee.",
        "Replace it with the real delivery address.",
      ),
    );
  }
}

function checkName(field, label, value, issues) {
  const text = String(value || "").trim();

  if (!text) {
    issues.push(
      issue(
        field,
        label,
        value,
        "No name is set.",
        "Add the recipient's name.",
      ),
    );
    return;
  }
  if (text.length < 3) {
    issues.push(
      issue(
        field,
        label,
        value,
        "Too short to be a real name.",
        "Enter the full name.",
      ),
    );
    return;
  }
  if (TEST_WORDS.test(text)) {
    issues.push(
      issue(
        field,
        label,
        value,
        "Contains placeholder text couriers reject as a suspicious consignee.",
        "Enter the recipient's real name.",
      ),
    );
  }
}

/**
 * Inspect a shipment record for data a courier is likely to reject.
 *
 * @param {Object} shipment - shipment row (or the subset selected for booking)
 * @returns {Array<{field, label, value, reason, fix, blocking}>}
 */
function diagnoseShipment(shipment = {}) {
  const issues = [];

  checkName(
    "deliveryName",
    "Delivery contact name",
    shipment.deliveryName,
    issues,
  );
  checkPhone("deliveryPhone", "Delivery phone", shipment.deliveryPhone, issues);
  checkAddress(
    "deliveryLine1",
    "Delivery address",
    shipment.deliveryLine1,
    issues,
  );

  checkName("pickupName", "Pickup contact name", shipment.pickupName, issues);
  checkPhone("pickupPhone", "Pickup phone", shipment.pickupPhone, issues);
  checkAddress("pickupLine1", "Pickup address", shipment.pickupLine1, issues);

  const product = String(
    shipment.productDescription || shipment.description || "",
  ).trim();
  if (!product) {
    issues.push(
      issue(
        "productDescription",
        "Product description",
        product,
        "No product description is set.",
        'Describe the contents, e.g. "Cotton T-shirt".',
        false,
      ),
    );
  } else if (TEST_WORDS.test(product) || product.length < 3) {
    issues.push(
      issue(
        "productDescription",
        "Product description",
        product,
        "Reads as placeholder text rather than real contents.",
        "Describe what is actually in the package.",
        false,
      ),
    );
  }

  return issues;
}

/**
 * True when the courier's message is the generic "bad consignee data" family,
 * i.e. the failure is worth explaining as field problems rather than a fault on
 * our side or theirs. Delhivery uses ER0005 / "suspicious order/consignee".
 */
function isDataQualityRejection(message = "", code = "") {
  const text = `${message} ${code}`.toLowerCase();
  return (
    text.includes("suspicious") ||
    text.includes("er0005") ||
    text.includes("consignee") ||
    text.includes("invalid phone") ||
    text.includes("invalid address")
  );
}

module.exports = { diagnoseShipment, isDataQualityRejection };
