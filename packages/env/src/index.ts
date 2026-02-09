import * as path from "path";
import * as dotenv from "dotenv";

/**
 * Load env once for the entire process.
 * Runtime env variables ALWAYS win.
 */
export function loadEnv() {
  dotenv.config({
    path: path.join(process.cwd(), ".env.local"),
    override: false,
  });
}
