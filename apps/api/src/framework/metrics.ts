import type { RequestHandler } from 'express';
const metrics = { requests: 0, errors: 0, started: Date.now() };
export const recordRequest: RequestHandler = (_req, res, next) => {
  metrics.requests++;
  res.on('finish', () => {
    if (res.statusCode >= 500) metrics.errors++;
  });
  next();
};
export function metricsSnapshot() {
  return {
    uptime_seconds: Math.floor((Date.now() - metrics.started) / 1000),
    total_requests: metrics.requests,
    total_errors: metrics.errors,
    error_rate: metrics.requests
      ? `${((metrics.errors / metrics.requests) * 100).toFixed(2)}%`
      : '0%',
    timestamp: new Date().toISOString()
  };
}
