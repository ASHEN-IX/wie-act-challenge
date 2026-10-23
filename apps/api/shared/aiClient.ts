/** Only outbound HTTP boundary to the independent Python AI server. */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export const getBaseUrl = (): string => process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function request(
  method: 'GET' | 'DELETE' | 'POST' | 'PUT' | 'PATCH',
  address: string,
  data?: unknown,
  config: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  const base = new URL(getBaseUrl());
  const url = new URL(address, base);
  if (url.origin !== base.origin) throw new Error('Outbound AI request must target AI_SERVICE_URL');

  const headers: AxiosRequestConfig['headers'] = Object.fromEntries(
    Object.entries(config.headers || {}).filter(
      ([key]) => !['cookie', 'authorization', 'x-internal-secret'].includes(key.toLowerCase())
    )
  );

  // Python receives only its configured service credential, never browser sessions.
  if (process.env.AI_SERVICE_API_KEY)
    headers.Authorization = `Bearer ${process.env.AI_SERVICE_API_KEY}`;

  const options: AxiosRequestConfig = {
    ...config,
    headers,
    timeout: config.timeout || Number(process.env.AI_SERVICE_TIMEOUT_MS || 30000)
  };

  // Retry a safe read once; never replay AI job creation or LLM mutations.
  for (let attempt = 0; ; attempt++) {
    try {
      switch (method.toUpperCase()) {
        case 'GET':
          return await axios.get(url.href, options);
        case 'DELETE':
          return await axios.delete(url.href, options);
        case 'POST':
          return await axios.post(url.href, data, options);
        case 'PUT':
          return await axios.put(url.href, data, options);
        case 'PATCH':
          return await axios.patch(url.href, data, options);
        default:
          throw new Error('Unsupported AI request method');
      }
    } catch (error) {
      const hasResponse =
        error && typeof error === 'object' && 'response' in error && error.response;
      if (method.toUpperCase() === 'GET' && attempt === 0 && !hasResponse) continue;
      throw error;
    }
  }
}

const aiClient = {
  getBaseUrl,
  request,
  get: (url: string, config?: AxiosRequestConfig) => request('GET', url, null, config),
  delete: (url: string, config?: AxiosRequestConfig) => request('DELETE', url, null, config),
  post: (url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request('POST', url, data, config),
  put: (url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request('PUT', url, data, config),
  patch: (url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request('PATCH', url, data, config)
};

export default aiClient;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = aiClient;
}
