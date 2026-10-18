import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({ plugins: [emailOTPClient()] });

export async function authResult(result: any): Promise<{ data: any }> {
  if (result.error) {
    const error: any = new Error(result.error.message);
    error.response = {
      status: result.error.status,
      data: {
        error: result.error.message,
        code: result.error.code === 'EMAIL_NOT_VERIFIED' ? 'EMAIL_NOT_VERIFIED' : result.error.code
      }
    };
    throw error;
  }
  return { data: result.data };
}
