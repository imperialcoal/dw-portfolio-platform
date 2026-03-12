import { createHmac, timingSafeEqual } from "crypto";

import { config } from "@dw/config";
import { isWebhookConfigured } from "@dw/validators/devops-env";

/**
 * Verify GitHub webhook HMAC-SHA256 signature.
 * Returns false (not throws) if GITHUB_WEBHOOK_SECRET is not configured,
 * so local dev doesn't crash — the webhook route will return 401 gracefully.
 */
export function verifyGitHubSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!isWebhookConfigured("github")) return false;
  if (!signature) return false;

  const secret = String(config.devops.GITHUB_WEBHOOK_SECRET);
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Verify Sentry webhook HMAC-SHA256 signature.
 * Returns false (not throws) if SENTRY_WEBHOOK_SECRET is not configured.
 */
export function verifySentrySignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!isWebhookConfigured("sentry")) return false;
  if (!signature) return false;

  const secret = String(config.devops.SENTRY_WEBHOOK_SECRET);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
