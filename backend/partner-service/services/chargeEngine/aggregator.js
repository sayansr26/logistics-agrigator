/**
 * Charges Engine v3 — line aggregator
 *
 * Applies each definition's aggregation policy to computed lines:
 *   - group + HIGHEST: only the highest line in the group survives (G2
 *     category semantics — e.g. two COD rules → the bigger one applies)
 *   - group + SUM (or no aggregation): lines are kept and summed
 *
 * perSide lines (pickup + delivery computed independently) are merged into a
 * single line upstream in the pipeline; the aggregator only sees final lines.
 */

function aggregate(lines) {
  const grouped = new Map(); // group -> { strategy, lines: [] }
  const passthrough = [];

  for (const line of lines) {
    const agg = line.aggregation;
    if (!agg || !agg.group) {
      passthrough.push(line);
      continue;
    }
    const bucket = grouped.get(agg.group) || {
      strategy: agg.strategy || "SUM",
      lines: [],
    };
    bucket.lines.push(line);
    grouped.set(agg.group, bucket);
  }

  const result = [...passthrough];

  for (const [, bucket] of grouped) {
    if (bucket.strategy === "HIGHEST" && bucket.lines.length > 1) {
      const highest = bucket.lines.reduce((max, l) =>
        l.totalCharge > max.totalCharge ? l : max,
      );
      result.push(highest);
    } else {
      result.push(...bucket.lines);
    }
  }

  // Stable ordering: phase, then code
  result.sort(
    (a, b) => a.phase - b.phase || a.chargeCode.localeCompare(b.chargeCode),
  );

  return result;
}

module.exports = { aggregate };
