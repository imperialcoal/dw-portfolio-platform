export interface DbHealthCheck {
  execute: (query: string) => Promise<unknown>;
}
export interface RedisHealthCheck {
  ping: () => Promise<string>;
  set: (key: string, value: string, ex: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
}

export async function verifyInfra(db: DbHealthCheck, redis: RedisHealthCheck) {
  // Environment Guard: Strict check to prevent cross-pollution
  if (
    process.env.NODE_ENV === "test" &&
    !process.env.DATABASE_URL?.includes("test")
  ) {
    throw new Error(
      "❌ SAFETY TRIGGER: NODE_ENV is 'test' but DATABASE_URL does not point to a test database.",
    );
  }

  const timeoutMs = process.env.CI ? 15000 : 3000;
  const testKey = `healthcheck:${Date.now()}`;

  await Promise.race([
    Promise.all([
      db.execute("SELECT 1"),
      // Redis Roundtrip: Ping -> Set -> Get
      redis.ping(),
      redis.set(testKey, "verified", 10),
      redis.get(testKey).then((val) => {
        if (val !== "verified") throw new Error("Redis Read/Write mismatch");
      }),
    ]),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Infra timeout")), timeoutMs),
    ),
  ]);

  console.log("✅ Local infrastructure verified (DB + Redis R/W)");
}
