/** Narrow exceptions from HTTP/module transports without trusting arbitrary thrown values. */
export function errorDetails(error: unknown): {
  message: string;
  code?: string | number;
  status?: number;
  data?: unknown;
} {
  const fields = error && typeof error === 'object' ? error : {};
  const response =
    'response' in fields && fields.response && typeof fields.response === 'object'
      ? fields.response
      : {};
  return {
    message:
      'message' in fields && typeof fields.message === 'string' ? fields.message : String(error),
    code:
      'code' in fields && (typeof fields.code === 'string' || typeof fields.code === 'number')
        ? fields.code
        : undefined,
    status:
      'status' in response && typeof response.status === 'number' ? response.status : undefined,
    data: 'data' in response ? response.data : undefined
  };
}
