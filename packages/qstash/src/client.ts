import { Client } from "@upstash/qstash";

import { isQStashConfigured, qstashEnv } from "@dw/validators/qstash-env";

const globalForQStash = globalThis as unknown as {
  qstash?: Client;
};

function createQStashClient(): Client {
  if (!isQStashConfigured()) {
    throw new Error(
      "QStash is not configured. Set QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, " +
        "and QSTASH_NEXT_SIGNING_KEY in Doppler to enable job queuing.",
    );
  }

  const env = qstashEnv();

  return new Client({ token: env.QSTASH_TOKEN });
}

export function getQStash(): Client {
  if (globalForQStash.qstash) {
    return globalForQStash.qstash;
  }

  const client = createQStashClient();
  globalForQStash.qstash = client;
  return client;
}

export type { Client as QStashClient };
