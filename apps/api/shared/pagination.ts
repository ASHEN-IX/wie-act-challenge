export function boundedInteger(value: unknown, fallback = 50, maximum = 100): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function activityRange(start: unknown, end: unknown, now = new Date()) {
  const upper = end ? new Date(String(end)) : now;
  const lower = start ? new Date(String(start)) : new Date(upper.getTime() - 90 * 86400000);
  if (
    !Number.isFinite(upper.getTime()) ||
    !Number.isFinite(lower.getTime()) ||
    lower > upper ||
    upper.getTime() - lower.getTime() > 366 * 86400000
  ) {
    throw Object.assign(new Error('Date range must be valid and no greater than 366 days'), {
      statusCode: 400
    });
  }
  return { $gte: lower, $lte: upper };
}

/**
 * The same validated range as Prisma's DateTimeFilter. `activityRange` keeps
 * returning the `$gte`/`$lte` shape for callers that still build raw filters;
 * new Prisma queries use this.
 */
export function activityRangeFilter(start: unknown, end: unknown, now = new Date()) {
  const { $gte, $lte } = activityRange(start, end, now);
  return { gte: $gte, lte: $lte };
}

module.exports = { boundedInteger, activityRange, activityRangeFilter };
