/**
 * chargeEngine/milestoneMatch — distance -> milestone resolution.
 *
 * Pins the fractional-gap fix: milestone bounds are Int columns describing
 * contiguous bands while road distance is fractional, so comparing the raw
 * value used to leave 50.01-50.99 (and friends) matching nothing, whereupon
 * the highest-milestone fallback billed them the LONGEST-haul rate.
 */

const {
  matchMilestoneByDistance,
  matchMilestoneAcrossZones,
  highestMilestone,
  normalizeName,
  toMatchKm,
} = require("../services/chargeEngine/milestoneMatch");

// The real prod partner (Delhivery B2C).
const MILESTONES = [
  { id: "ms-a", suffix: "A", minKm: 0, maxKm: 50, sortOrder: 1 },
  { id: "ms-b", suffix: "B", minKm: 51, maxKm: 500, sortOrder: 2 },
  { id: "ms-c", suffix: "C", minKm: 501, maxKm: 1400, sortOrder: 3 },
  { id: "ms-d", suffix: "D", minKm: 1401, maxKm: 3200, sortOrder: 4 },
];

describe("matchMilestoneByDistance", () => {
  // 50.5 / 50.99 / 500.5 / 1400.9 all returned D before the fix.
  test.each([
    [0, "A"],
    [50, "A"],
    [50.5, "A"],
    [50.99, "A"],
    [51, "B"],
    [500, "B"],
    [500.5, "B"],
    [500.99, "B"],
    [501, "C"],
    [1400, "C"],
    [1400.9, "C"],
    [1401, "D"],
    [3200, "D"],
    [3200.5, "D"], // floors to 3200, still inside D
  ])("%s km resolves to milestone %s in range", (km, suffix) => {
    const { milestone, matchedBy } = matchMilestoneByDistance(km, MILESTONES);
    expect(milestone.suffix).toBe(suffix);
    expect(matchedBy).toBe("RANGE");
  });

  test.each([3201, 3700, 5000])(
    "%s km is beyond every band and falls back to the highest",
    (km) => {
      const { milestone, matchedBy } = matchMilestoneByDistance(km, MILESTONES);
      expect(milestone.suffix).toBe("D");
      expect(matchedBy).toBe("HIGHEST_FALLBACK");
    },
  );

  test("floors rather than rounds, so 50.6 never reaches the pricier band", () => {
    // Math.round would put this in B (51-500) — a milder version of the very
    // overcharge being fixed.
    expect(matchMilestoneByDistance(50.6, MILESTONES).milestone.suffix).toBe(
      "A",
    );
  });

  test("no milestones at all is a clean miss, not a throw", () => {
    expect(matchMilestoneByDistance(30, []).milestone).toBeNull();
  });

  test.each([-1, NaN, null, undefined, "abc"])(
    "%p is not a usable distance",
    (km) => {
      expect(matchMilestoneByDistance(km, MILESTONES).milestone).toBeNull();
    },
  );
});

describe("matchMilestoneAcrossZones", () => {
  test("usedFallback is false for every in-range distance", () => {
    for (const km of [0, 50, 50.5, 51, 501, 1401, 3200]) {
      const r = matchMilestoneAcrossZones(km, [{ milestones: MILESTONES }]);
      expect(r.usedFallback).toBe(false);
    }
  });

  test("usedFallback is true beyond the configured maximum", () => {
    const r = matchMilestoneAcrossZones(9999, [{ milestones: MILESTONES }]);
    expect(r.usedFallback).toBe(true);
    expect(r.milestone.suffix).toBe("D");
  });

  test("the fallback is the GLOBAL max, not whichever zone came first", () => {
    // The original inline version only updated its tracker on the non-matching
    // branch and broke out on a match, making this order-dependent.
    const zones = [
      {
        name: "short",
        milestones: [{ id: "s", suffix: "S", minKm: 0, maxKm: 10 }],
      },
      {
        name: "long",
        milestones: [{ id: "l", suffix: "L", minKm: 0, maxKm: 9000 }],
      },
    ];
    const r = matchMilestoneAcrossZones(50000, zones);
    expect(r.milestone.suffix).toBe("L");
    expect(r.zone.name).toBe("long");
  });

  test("returns a clean miss when no zone has any milestone", () => {
    const r = matchMilestoneAcrossZones(30, [{ milestones: [] }]);
    expect(r.milestone).toBeNull();
    expect(r.usedFallback).toBe(false);
  });
});

describe("helpers", () => {
  test("highestMilestone picks the greatest maxKm", () => {
    expect(
      highestMilestone([{ milestones: MILESTONES }]).milestone.suffix,
    ).toBe("D");
  });

  test("toMatchKm floors", () => {
    expect(toMatchKm(50.99)).toBe(50);
    expect(toMatchKm(51)).toBe(51);
  });

  test("normalizeName keeps the two live Delhivery channels distinct", () => {
    // The whole anti-fuzzy-match argument rests on this staying true.
    expect(normalizeName("Delhivery0.5 Surface")).toBe("delhivery05surface");
    expect(normalizeName("Delhivery 5kg Surface")).toBe("delhivery5kgsurface");
    expect(normalizeName("Delhivery0.5 Surface")).not.toBe(
      normalizeName("Delhivery 5kg Surface"),
    );
  });
});
