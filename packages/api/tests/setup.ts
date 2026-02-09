/* eslint-disable no-restricted-properties */

// OVERRIDE connection string to point to Test DB
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/dw_test";
  process.env.DATABASE_URL = url.toString();
}
