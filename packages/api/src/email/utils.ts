import { apiEnv } from "@dw/validators/api-env";

export function isResendConfigured(): boolean {
  const env = apiEnv();
  return !!(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL && env.RESEND_TO_EMAIL);
}
