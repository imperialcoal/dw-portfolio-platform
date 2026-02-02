export interface DbHealthCheck {
  execute: (query: string) => Promise<unknown>;
}

export interface RedisHealthCheck {
  ping: () => Promise<string>;
}

export async function verifyInfra(db: DbHealthCheck, redis: RedisHealthCheck) {
  await Promise.race([
    Promise.all([db.execute("select 1"), redis.ping()]),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Infra timeout")), 3000),
    ),
  ]);

  console.log("✅ Local platform infrastructure connected");
}
