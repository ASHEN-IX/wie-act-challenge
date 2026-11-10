import { errorDetails } from '@noveris/shared/errors';
import moduleClient from '@noveris/shared/moduleClient';

// Temporary logger until shared package is fixed
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string, ...args: unknown[]) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`)
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiClient = require('@noveris/shared/aiClient');
const AI_SERVICE_URL =
  (aiClient.getBaseUrl ? aiClient.getBaseUrl() : null) || 'http://localhost:8000';

/**
 * Check if AI service is healthy
 * @returns {Promise<boolean>}
 */
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const response = await moduleClient.get(`${AI_SERVICE_URL}/health`, {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    logger.error('AI service health check failed:', errorDetails(error).message);
    return false;
  }
}

export default {
  checkAIServiceHealth
};
module.exports = {
  checkAIServiceHealth
};
