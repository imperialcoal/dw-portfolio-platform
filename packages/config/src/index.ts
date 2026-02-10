import { apiEnv } from "@dw/validators/api-env";
import { authEnv } from "@dw/validators/auth-env";
import { dbEnv } from "@dw/validators/db-env";

/**
 * Single runtime config composed from validated envs
 */
export const config = Object.freeze({
  app: apiEnv(),
  auth: authEnv(),
  db: dbEnv(),
});

export type Config = typeof config;
