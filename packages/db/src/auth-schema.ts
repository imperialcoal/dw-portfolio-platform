// packages/db/src/auth-schema.ts
//
// Changes in this version:
//   - Renamed "viewer" → "recruiter" in roleEnum
//     Recruiters have full platform access (same as admin) during demo period.
//     The role name distinguishes demo sessions from owner sessions in logs
//     and the platform banner, but carries no capability restrictions.
//
// Note: Renaming a Postgres enum value requires a migration.
// See packages/db/drizzle/0004_rename_viewer_to_recruiter.sql

import { pgEnum, pgTable } from "drizzle-orm/pg-core";

// ── Role enum ─────────────────────────────────────────────────────────────────
// admin     — owner; full platform access
// recruiter — demo account; full platform access (same as admin)
// user      — authenticated but no /platform access
export const roleEnum = pgEnum("role", ["admin", "recruiter", "user"]);

// ── user table ────────────────────────────────────────────────────────────────
export const user = pgTable(
  "user",
  (t) => ({
    id: t.text().primaryKey(),
    email: t.text().notNull().unique(),
    emailVerified: t.boolean().notNull().default(false),
    name: t.text(),
    image: t.text(),
    role: roleEnum().notNull().default("user"),
    banned: t.boolean().notNull().default(false),
    primaryOrgId: t.text(),
    metadata: t.jsonb().$type<Record<string, unknown>>().default({}),
    createdAt: t.timestamp().notNull(),
    updatedAt: t.timestamp().notNull(),
    lastSeenAt: t.timestamp(),
    deletedAt: t.timestamp(),
  }),
  (_table) => [{ enableRls: true }],
);
