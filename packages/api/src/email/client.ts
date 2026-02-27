import { Resend } from "resend";

import { apiEnv } from "@dw/validators/api-env";

import { isResendConfigured } from "./utils";

export function getResendClient(): Resend {
  const env = apiEnv();

  if (!isResendConfigured()) {
    throw new Error(
      "Resend is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and RESEND_TO_EMAIL to enable email features.",
    );
  }

  return new Resend(String(env.RESEND_API_KEY));
}
