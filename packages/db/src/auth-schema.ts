// Changes in this version:
//   1. Added "viewer" to roleEnum (recruiter read-only demo role)
//   2. Added enableRls in the table extras callback.
//      Drizzle Kit will emit ALTER TABLE "user" ENABLE ROW LEVEL SECURITY
//      in the next generated migration. The actual RLS *policies* live in
//      packages/db/drizzle/0003_rls_policies.sql.
//
// Note: the extras callback parameter is prefixed with _ to satisfy the
// @typescript-eslint/no-unused-vars rule — it is required by the Drizzle
// API signature but we don't reference any columns in the extras array.

import { pgEnum, pgTable } from "drizzle-orm/pg-core";

// ── Role enum ─────────────────────────────────────────────────────────────────
// admin  — full platform access + destructive actions
// viewer — read-only platform access (recruiter demo accounts)
// user   — authenticated but no /platform access
export const roleEnum = pgEnum("role", ["admin", "viewer", "user"]);

// ── user table ────────────────────────────────────────────────────────────────
export const user = pgTable(
  "user",
  (t) => ({
    // Clerk User ID
    id: t.text().primaryKey(),

    // Identity
    email: t.text().notNull().unique(),
    emailVerified: t.boolean().notNull().default(false),

    name: t.text(),
    image: t.text(),

    // Authorization
    role: roleEnum().notNull().default("user"),
    banned: t.boolean().notNull().default(false),

    // Org support
    primaryOrgId: t.text(),

    // Metadata / flags
    metadata: t.jsonb().$type<Record<string, unknown>>().default({}),

    // Lifecycle
    createdAt: t.timestamp().notNull(),
    updatedAt: t.timestamp().notNull(),

    lastSeenAt: t.timestamp(),
    deletedAt: t.timestamp(),
  }),
  // _table is required by the Drizzle pgTable API signature but not used here —
  // we only need enableRls, which has no column references.
  (_table) => [{ enableRls: true }],
);
