/**
 * Distance -> ZoneMilestone matching (Charges Engine v3).
 *
 * The single source of truth for "which milestone does this shipment fall in".
 * Consumed by distanceZoneService (production pricing) and by the rate-card
 * replay harness, so the two can never drift: if replay mirrored this logic by
 * copy-paste, a later fix to one would silently make the other lie.
 *
 * Pure and synchronous — milestones arrive as data, so there is no DB or cache
 * here and callers own their own I/O.
 */

/**
 * ZoneMilestone.minKm/maxKm are Int columns describing contiguous bands
 * (0-50, 51-500, 501-1400, 1401-3200) while road distance is fractional.
 * Comparing the raw value leaves every fractional gap (50.01-50.99,
 * 500.01-500.99, ...) unmatched, and the highest-milestone fallback below then
 * charges those shipments the LONGEST-haul rate — a silent overcharge.
 *
 * Flooring makes the bands gapless: A=[0,51) B=[51,501) C=[501,1401) D=[1401,3201).
 * Floor rather than round, deliberately: rounding is also gapless but pushes
 * 50.6 km into the 51-500 band, re-creating a milder version of the same
 * overcharge. Flooring is monotonic and never moves a shipment into a more
 * expensive band.
 */
function toMatchKm(distanceKm) {
  // Guard the type before coercing: Number(null) and Number("") are both 0,
  // which would silently price a missing distance as a 0 km shipment.
  if (typeof distanceKm !== "number") return null;
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return Math.floor(distanceKm);
}

/**
 * Pick the milestone with the greatest maxKm across every zone.
 *
 * Computed in its own pass on purpose. The original inline version updated its
 * tracker only on the non-matching branch and broke out of the loop on a match,
 * so which milestone became the fallback depended on iteration order rather
 * than being reliably the global maximum.
 */
function highestMilestone(zones) {
  let bestZone = null;
  let bestMilestone = null;

  for (const zone of zones) {
    for (const milestone of zone.milestones || []) {
      if (!bestMilestone || milestone.maxKm > bestMilestone.maxKm) {
        bestZone = zone;
        bestMilestone = milestone;
      }
    }
  }

  return { zone: bestZone, milestone: bestMilestone };
}

/**
 * Match a distance against one zone's milestones.
 *
 * @param {number} distanceKm
 * @param {Array<{id,suffix,minKm,maxKm,sortOrder}>} milestones
 * @returns {{ milestone: object|null, matchedBy: "RANGE"|"HIGHEST_FALLBACK"|null }}
 */
function matchMilestoneByDistance(distanceKm, milestones = []) {
  return matchMilestoneAcrossZones(distanceKm, [{ milestones }]);
}

/**
 * Match a distance across several zones, preferring an in-range hit and falling
 * back to the highest milestone so distances beyond the configured maximum stay
 * serviceable (charged at the top rate).
 *
 * @param {number} distanceKm
 * @param {Array<{ milestones: Array }>} zones
 * @returns {{ zone, milestone, matchedBy, usedFallback }}
 */
function matchMilestoneAcrossZones(distanceKm, zones = []) {
  const matchKm = toMatchKm(distanceKm);
  const miss = {
    zone: null,
    milestone: null,
    matchedBy: null,
    usedFallback: false,
  };
  if (matchKm === null) return miss;

  for (const zone of zones) {
    for (const milestone of zone.milestones || []) {
      if (matchKm >= milestone.minKm && matchKm <= milestone.maxKm) {
        return { zone, milestone, matchedBy: "RANGE", usedFallback: false };
      }
    }
  }

  const fallback = highestMilestone(zones);
  if (!fallback.milestone) return miss;

  return {
    zone: fallback.zone,
    milestone: fallback.milestone,
    matchedBy: "HIGHEST_FALLBACK",
    usedFallback: true,
  };
}

/** Lowercase and strip every non-alphanumeric — for name matching. */
function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

module.exports = {
  matchMilestoneByDistance,
  matchMilestoneAcrossZones,
  highestMilestone,
  normalizeName,
  toMatchKm,
};
