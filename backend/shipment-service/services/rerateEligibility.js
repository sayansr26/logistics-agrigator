/**
 * Who may re-rate a shipment, and when.
 *
 * Weight disputes surface late: a partner picks a parcel up, weighs it on their
 * own scale, and reports 1kg against the 0.5kg the customer booked. That report
 * can arrive at any point in the shipment's life — after pickup, in transit,
 * even after delivery when reconciling the partner's invoice. Locking re-rating
 * to the early statuses left admins with no way to recover the difference.
 *
 * So: admins and superadmins may re-rate in any status except the terminal ones
 * where there is nothing left to settle (CANCELLED). Everyone else keeps the
 * original early-status window.
 */

/** Statuses a non-admin may re-rate in. */
const STANDARD_RERATE_STATUSES = [
  "CREATED",
  "BOOKED",
  "PICKED_UP",
  "IN_TRANSIT",
];

/**
 * Statuses nobody may re-rate in. A cancelled shipment has already been
 * refunded — re-pricing it would charge for a parcel that was never carried.
 */
const NEVER_RERATEABLE_STATUSES = ["CANCELLED"];

const ELEVATED_ROLES = ["admin", "superadmin"];

/**
 * @param {?string} role - the acting user's role
 * @returns {boolean} true when the role may re-rate outside the standard window
 */
function hasElevatedRerateRights(role) {
  return ELEVATED_ROLES.includes(String(role || "").toLowerCase());
}

/**
 * Decide whether this user may re-rate this shipment right now.
 *
 * @param {string} status - the shipment's current status
 * @param {?string} role - the acting user's role
 * @returns {{allowed: boolean, reason: ?string}} reason is a user-facing message
 */
function checkRerateEligibility(status, role) {
  if (NEVER_RERATEABLE_STATUSES.includes(status)) {
    return {
      allowed: false,
      reason: `A ${String(status).toLowerCase()} shipment cannot be re-rated — it has already been settled.`,
    };
  }

  if (hasElevatedRerateRights(role)) {
    return { allowed: true, reason: null };
  }

  if (STANDARD_RERATE_STATUSES.includes(status)) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: `Shipment can only be re-rated in ${STANDARD_RERATE_STATUSES.join(", ")} status. Ask an admin to re-rate a shipment past ${STANDARD_RERATE_STATUSES[STANDARD_RERATE_STATUSES.length - 1]}.`,
  };
}

/**
 * Hold note for a re-rate the wallet could not cover. Names the weight change
 * explicitly when there was one, so the operator sees *why* the extra was owed
 * rather than only that a charge failed.
 */
function buildHoldReason({ oldCost, newCost, oldWeight, newWeight, reason }) {
  const weightChanged =
    Number.isFinite(Number(oldWeight)) &&
    Number.isFinite(Number(newWeight)) &&
    Number(oldWeight) !== Number(newWeight);

  const parts = [];
  if (weightChanged) {
    parts.push(
      `Weight mismatch: booked at ${oldWeight}kg, re-rated at ${newWeight}kg.`,
    );
  }
  parts.push(
    `Insufficient wallet balance to settle the difference. New charge: ₹${newCost}, previous charge: ₹${oldCost}, shortfall: ₹${(
      Number(newCost) - Number(oldCost)
    ).toFixed(2)}.`,
  );
  if (reason) parts.push(`Reason: ${reason}`);

  return parts.join(" ");
}

module.exports = {
  STANDARD_RERATE_STATUSES,
  NEVER_RERATEABLE_STATUSES,
  hasElevatedRerateRights,
  checkRerateEligibility,
  buildHoldReason,
};
