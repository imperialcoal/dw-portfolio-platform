export default function () {
  // 1. Fail fast if the environment is unsafe
  if (process.env.NODE_ENV !== "test") {
    throw new Error("🚨 FATAL: Tests must run with NODE_ENV=test");
  }

  // 2. Fail fast if the database URL isn't pointing to the test DB
  // This catches the issue where .env.local overrides the setup script
  if (
    !process.env.DATABASE_URL?.includes("test") &&
    !process.env.DIRECT_URL?.includes("test")
  ) {
    throw new Error(
      "🚨 FATAL: DATABASE_URL must point to a test database. Current value does not contain 'test'.",
    );
  }
}
