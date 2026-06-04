-- =============================================================================
-- Migration: 0003_rls_policies.sql
-- Enables Row Level Security on public.user and public.post.
--
-- Access model for this app:
--
--   All DB writes from the application go through:
--     1. Drizzle ORM via DATABASE_URL (PgBouncer transaction pooler)
--        → connects as the `authenticator` role (Supabase default)
--        → subject to RLS policies defined here
--
--     2. createAdminClient() (service_role JWT via SUPABASE_SECRET_DEFAULT_KEY)
--        → bypasses RLS entirely — used only for storage writes
--        → never used for user/post table reads or writes
--
--   All tRPC procedures that touch the DB run server-side (Node.js runtime),
--   authenticated as the Supabase `service_role` via DATABASE_URL.
--   Because DATABASE_URL uses the *transaction pooler* connection string
--   (port 6543), Postgres does NOT receive a JWT — so auth.uid() is NULL.
--
--   This means the correct RLS strategy for this app is NOT JWT-based
--   row ownership (auth.uid() = id), but service-level policies that
--   grant the authenticated service role appropriate access while locking
--   out the anon role entirely.
--
-- Why this matters:
--   Supabase exposes all tables via PostgREST. Without RLS, the anon role
--   (used by any unauthenticated HTTP request to your project URL) can
--   SELECT, INSERT, UPDATE, and DELETE every row. The Security Advisor
--   flags this as ERROR: RLS Disabled in Public.
--
-- After this migration:
--   ✓ public.user  — RLS enabled, anon blocked, service_role full access
--   ✓ public.post  — RLS enabled, anon blocked, service_role full access
--   ✓ Security Advisor advisories will resolve on next scan
--
-- NOTE: anon and authenticated roles have NO direct access to either table.
--   All reads and writes go through tRPC → Drizzle → service_role.
--   PostgREST direct access is not a supported path for this app.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Enable RLS on both tables
-- We add policies before enabling to avoid a window of total lockout.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- TABLE: public.user
-- =============================================================================

-- service_role can do everything (Drizzle ORM, Clerk webhook sync,
-- ensureUserProvisioned, lastSeenAt updates, role changes, ban checks).
CREATE POLICY "service_role_all_user"
  ON public."user"
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon role: no access at all.
-- (No explicit DENY policy needed — with RLS enabled and no anon policy,
--  the default is DENY for any role not explicitly granted.)

ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user" FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- TABLE: public.post
-- =============================================================================

-- service_role full access — covers all tRPC mutations:
--   post.create (adminProcedure → INSERT)
--   post.delete (adminProcedure → DELETE)
--   post.all / post.byId cache misses (publicProcedure → SELECT via Drizzle)
--
-- anon role: no direct access.
--   post.all and post.byId are publicProcedure but go through
--   Drizzle + PgBouncer (service_role) — never direct PostgREST.
CREATE POLICY "service_role_all_post"
  ON public.post
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.post ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 2: Revoke all anon and authenticated grants on both tables
--
-- Supabase grants broad privileges to anon and authenticated roles on
-- newly-created tables by default. Revoking these removes the
-- "Exposed to Anon Role" Security Advisor warnings as defence in depth
-- on top of the RLS policies above.
-- =============================================================================

REVOKE ALL ON public."user" FROM anon;
REVOKE ALL ON public."user" FROM authenticated;
REVOKE ALL ON public.post FROM anon;
REVOKE ALL ON public.post FROM authenticated;


-- =============================================================================
-- STEP 3: Verify (run these SELECT queries after applying to confirm)
-- =============================================================================

-- Expected: both rows show relrowsecurity = true, relforcerowsecurity = true
--
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class
-- WHERE relname IN ('user', 'post')
--   AND relnamespace = 'public'::regnamespace;
--
-- Expected: 2 policies visible (service_role_all_user, service_role_all_post)
--
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('user', 'post')
-- ORDER BY tablename, policyname;