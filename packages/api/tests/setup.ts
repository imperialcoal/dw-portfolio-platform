/* eslint-disable no-restricted-properties */

// 1. OVERRIDE connection string to point to Test DB
// This MUST happen before we import any app code or singletons!
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);

  // Safety check: ensure we are targeting the test DB
  if (!url.pathname.endsWith("test")) {
    url.pathname = "/dw_test";
  }

  const testUrl = url.toString();
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
} else {
  // Fallback if env vars are missing entirely (e.g. running outside CI/Turbo)
  process.env.DATABASE_URL =
    "postgresql://postgres:password@localhost:5433/dw_test";
  process.env.DIRECT_URL =
    "postgresql://postgres:password@localhost:5433/dw_test";
}

// 2. Initialize Runtime
// We use a dynamic import here to ensure the config package picks up
// the NEW process.env values we just set above.
const { runtimeEntry } = await import("@dw/runtime/runtime-entry");

await runtimeEntry();

// 3. Ensure test mode flags
// We cast process.env to a generic dictionary. This removes the "readonly"
// constraint on specific keys like NODE_ENV while avoiding 'any'.
const env = process.env as Record<string, string | undefined>;

env.NODE_ENV ??= "test";
env.APP_ENV ??= "test";
