import { config } from "@dw/config";
import { isWebhookConfigured } from "@dw/validators/devops-env";

// Web Crypto API — works in both Edge and Node.js runtimes.
// Node.js crypto (createHmac, timingSafeEqual) is not available in Edge.

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify GitHub webhook HMAC-SHA256 signature.
 * Returns false (not throws) if GITHUB_WEBHOOK_SECRET is not configured.
 */
export async function verifyGitHubSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!isWebhookConfigured("github")) return false;
  if (!signature) return false;

  const secret = String(config.devops.GITHUB_WEBHOOK_SECRET);
  const expected = `sha256=${await hmacSha256(secret, rawBody)}`;
  return safeEqual(signature, expected);
}

/**
 * Verify Sentry webhook HMAC-SHA256 signature.
 * Returns false (not throws) if SENTRY_WEBHOOK_SECRET is not configured.
 */
export async function verifySentrySignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!isWebhookConfigured("sentry")) return false;
  if (!signature) return false;

  const secret = String(config.devops.SENTRY_WEBHOOK_SECRET);
  const expected = await hmacSha256(secret, rawBody);
  return safeEqual(signature, expected);
}
