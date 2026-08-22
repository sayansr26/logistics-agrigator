/**
 * Public tracking milestones.
 *
 * A customer tracking a parcel wants to know how far along it is — not every
 * courier scan, and certainly not our internal events. The raw event stream
 * carries operational and financial detail ("Shipment re-rated: ₹232.46 →
 * ₹274.94", hold reasons, partner error text) which must never reach a page
 * anyone can open with just an AWB.
 *
 * So the public view is reduced to a fixed ladder of six milestones. Every
 * shipment status maps onto one of them, and only the milestone — never the
 * underlying message — is exposed.
 */

/** The ladder, in order. `key` is stable; `label` is customer-facing. */
const MILESTONES = [
  { key: "CREATED", label: "Order placed" },
  { key: "BOOKED", label: "Booked with courier" },
  { key: "PICKED_UP", label: "Picked up" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
];

/**
 * Shipment status → milestone key.
 *
 * Statuses that are not points on the journey (HOLD, NDR) deliberately map to
 * the last milestone the parcel actually reached, so an internal payment hold
 * or a failed delivery attempt does not appear as a customer-visible stage.
 */
const STATUS_TO_MILESTONE = {
  CREATED: "CREATED",
  BOOKED: "BOOKED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  NDR: "OUT_FOR_DELIVERY",
  HOLD: "BOOKED",
  RTO: "IN_TRANSIT",
  CANCELLED: "CREATED",
};

/** Statuses that end the journey without reaching DELIVERED. */
const TERMINAL_LABELS = {
  CANCELLED: "Cancelled",
  RTO: "Returning to sender",
};

function milestoneIndex(statusOrKey) {
  const key = STATUS_TO_MILESTONE[statusOrKey] || statusOrKey;
  return MILESTONES.findIndex((m) => m.key === key);
}

/**
 * Build the customer-facing milestone ladder for a shipment.
 *
 * Timestamps come from the shipment's own events, but only the milestone's
 * first occurrence is used and the event's message is discarded.
 *
 * @param {string} status - current shipment status
 * @param {Array<{status: string, timestamp: string|Date}>} events
 * @returns {{milestones: Array, currentIndex: number, terminal: ?string}}
 */
function buildMilestones(status, events = []) {
  const currentIndex = milestoneIndex(status);

  // Earliest timestamp seen for each milestone.
  const reachedAt = {};
  for (const event of events) {
    const key = STATUS_TO_MILESTONE[event?.status];
    if (!key || !event?.timestamp) continue;
    const ts = new Date(event.timestamp).toISOString();
    if (!reachedAt[key] || ts < reachedAt[key]) reachedAt[key] = ts;
  }

  const milestones = MILESTONES.map((m, i) => ({
    key: m.key,
    label: m.label,
    state:
      i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
    // Only reveal a time for stages actually reached.
    reachedAt: i <= currentIndex ? reachedAt[m.key] || null : null,
  }));

  return {
    milestones,
    currentIndex,
    terminal: TERMINAL_LABELS[status] || null,
  };
}

/**
 * Reduce a tracking payload to what is safe to serve publicly.
 *
 * Allow-list, not deny-list: anything not named here is dropped, so a new
 * internal field cannot leak by being forgotten.
 */
function toPublicTracking(trackingData = {}) {
  const { milestones, currentIndex, terminal } = buildMilestones(
    trackingData.status,
    trackingData.events || [],
  );

  return {
    awbNumber: trackingData.awbNumber || null,
    status: trackingData.status || null,
    milestones,
    currentIndex,
    terminal,
    estimatedDelivery: trackingData.estimatedDelivery || null,
    actualDelivery: trackingData.actualDelivery || null,
    destination: trackingData.destination
      ? {
          city: trackingData.destination.city || null,
          state: trackingData.destination.state || null,
        }
      : null,
  };
}

module.exports = {
  MILESTONES,
  STATUS_TO_MILESTONE,
  buildMilestones,
  toPublicTracking,
};
