import { pgTable } from "drizzle-orm/pg-core";

export const user = pgTable("user", (t) => ({
  // Clerk User ID
  id: t.text().primaryKey(),

  // Identity
  email: t.text().notNull().unique(),
  emailVerified: t.boolean().notNull().default(false),

  name: t.text(),
  image: t.text(),

  // Authorization
  role: t.text().notNull().default("user"),
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
}));
