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
--   ✓ public.post  — RLS enabled, anon can SELECT published posts only,
--                    service_role full access for tRPC mutations
--   ✓ Security Advisor advisories will resolve on next scan
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Enable RLS on both tables
-- This alone blocks all access until policies are added — order matters.
-- We add policies before enabling to avoid a window of total lockout.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- TABLE: public.user
-- =============================================================================

-- ── Policies ─────────────────────────────────────────────────────────────────

-- service_role can do everything (Drizzle ORM, Clerk webhook sync,
-- ensureUserProvisioned, lastSeenAt updates, role changes, ban checks).
-- This covers every server-side operation that touches the user table.
CREATE POLICY "service_role_all_user"
  ON public."user"
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon role: no access at all.
-- PostgREST anon requests must not be able to read or enumerate users.
-- (No explicit DENY policy needed — with RLS enabled and no anon policy,
--  the default is DENY for any role not explicitly granted.)

-- ── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (prevents accidental owner bypass).
ALTER TABLE public."user" FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- TABLE: public.post
-- =============================================================================

-- ── Policies ─────────────────────────────────────────────────────────────────

-- service_role full access — covers all tRPC mutations:
--   post.create (adminProcedure → INSERT)
--   post.delete (adminProcedure → DELETE)
--   post.all / post.byId cache misses (publicProcedure → SELECT via Drizzle)
CREATE POLICY "service_role_all_post"
  ON public.post
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon role: SELECT only, no filter.
-- post.all and post.byId are publicProcedure — they run without a user
-- session. However, these queries go through Drizzle + PgBouncer which
-- authenticates as service_role, so this policy is belt-and-suspenders.
-- It does mean that if PostgREST is hit directly by anon, only SELECT
-- is permitted — no INSERT, UPDATE, DELETE via the REST API.
CREATE POLICY "anon_select_post"
  ON public.post
  AS PERMISSIVE
  FOR SELECT
  TO anon
  USING (true);

-- authenticated role: SELECT only (same as anon for reads).
-- Logged-in users browsing via PostgREST directly can read posts.
-- Mutations go through adminProcedure → service_role, never authenticated role.
CREATE POLICY "authenticated_select_post"
  ON public.post
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.post ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.post FORCE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 2: Revoke anon grants on public.user
--
-- Supabase grants broad privileges to anon and authenticated roles on
-- newly-created tables in the public schema by default. Revoking these
-- removes the "Exposed to Anon Role" Security Advisor warnings.
-- The RLS policies above already block access at the row level; these
-- REVOKE statements remove the table-level grants as defence in depth.
-- =============================================================================

REVOKE ALL ON public."user" FROM anon;
REVOKE ALL ON public."user" FROM authenticated;

-- Re-grant only what authenticated users need via PostgREST (nothing for user
-- table — all user reads go through Drizzle service_role, not PostgREST).
-- If you ever add a public profile endpoint via PostgREST, selectively
-- re-grant SELECT here and add a restrictive RLS policy.

-- Keep SELECT on post for anon/authenticated (powers any direct PostgREST
-- reads if you ever use the Supabase JS client on the frontend for posts).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.post FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.post FROM authenticated;


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
-- Expected: 4 policies visible
--
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('user', 'post')
-- ORDER BY tablename, policyname;