import { z } from "zod";

export const nodeEnvSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]),
};

export const appEnvSchema = {
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "test", "preview", "production"]),
};

export const redisSchema = {
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
};

export const databaseSchema = {
  DATABASE_URL: z.url(),
};
