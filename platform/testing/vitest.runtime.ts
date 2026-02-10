import { exec } from "node:child_process";
import { promisify } from "node:util";

const execPromise = promisify(exec);

export default async function () {
  // Ensure DB recreated + seeded
  await execPromise("pnpm dev-tools:test:setup");
  await execPromise("pnpm dev-tools:db:seed");
}
