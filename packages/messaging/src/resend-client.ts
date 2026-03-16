import { Resend } from "resend";

import {
  isMessagingConfigured,
  messagingEnv,
} from "@dw/validators/messaging-env";

export { Resend };

export function getResendClient(): Resend {
  if (!isMessagingConfigured()) {
    throw new Error(
      "Resend is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and " +
        "RESEND_TO_EMAIL in Doppler to enable email features.",
    );
  }

  const env = messagingEnv();

  return new Resend(env.RESEND_API_KEY);
}
