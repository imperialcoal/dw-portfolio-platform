import { Receiver } from "@upstash/qstash";

import { qstashEnv } from "@dw/validators/qstash-env";

/**
 * Verifies that an incoming request originated from QStash.
 * Uses the official @upstash/qstash Receiver which handles:
 * - JWT signature verification
 * - Body hash validation
 * - Token expiry check
 * - Current + next key rotation automatically
 *
 * Returns true if the request is valid, false otherwise.
 * Never throws — callers should return 401 on false.
 */
export async function verifyQStashRequest(
  signature: string | null,
  body: string,
): Promise<boolean> {
  const env = qstashEnv();

  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    // QStash not configured — reject all requests for safety
    console.warn(
      JSON.stringify({
        level: "warn",
        qstash: "verify",
        message: "QStash signing keys not configured",
      }),
    );
    return false;
  }

  if (!signature) return false;

  try {
    const receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });

    await receiver.verify({
      signature,
      body,
    });

    return true;
  } catch {
    return false;
  }
}
