import { Resend } from "resend";

import { messagingEnv } from "@dw/validators/messaging-env";

export { Resend };

export function getResendClient(): Resend {
  const env = messagingEnv();

  if (!env.RESEND_API_KEY) {
    throw new Error(
      "Resend is not configured. Set RESEND_API_KEY to enable email features.",
    );
  }

  return new Resend(env.RESEND_API_KEY);
}
