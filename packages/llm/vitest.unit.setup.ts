// Sets mock env before any module import. @dw/llm imports @dw/config, which
// runs every validator at load. CI skips validation (CI=true); local runs don't.
// Values are inert: these tests mock Anthropic and never open a connection.
Object.assign(process.env, {
  NODE_ENV: process.env.NODE_ENV ?? "test",
  APP_ENV: process.env.APP_ENV ?? "test",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5433/dw_test",
  DIRECT_URL:
    process.env.DIRECT_URL ??
    "postgresql://postgres:password@localhost:5433/dw_test",
  // Unconditional: unit tests must never pick up a real key from the shell.
  // The SDK is mocked, but getAnthropicClient() still requires a key to exist.
  ANTHROPIC_API_KEY: "test-key-not-real",
});
