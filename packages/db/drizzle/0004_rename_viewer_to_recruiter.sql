-- Renames the "viewer" role enum value to "recruiter".
--
-- Postgres does not support ALTER TYPE ... RENAME VALUE in older versions,
-- but PostgreSQL 10+ supports it directly. Supabase runs PG16, so this
-- is a single-statement migration.
--
-- After applying:
--   - Existing rows with role = 'viewer' are untouched (they keep their value
--     until manually updated — see step 3 below)
--   - New rows can use 'recruiter'
--   - 'viewer' is no longer a valid enum value
--
-- Manual steps after applying this migration:
--   1. Run this migration against preview and production
--   2. Update any existing 'viewer' rows:
--      UPDATE public."user" SET role = 'recruiter' WHERE role = 'viewer';
--   3. Run `pnpm dw db generate` if you want Drizzle Kit to track this

ALTER TYPE "public"."role" RENAME VALUE 'viewer' TO 'recruiter';