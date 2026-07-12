// Pure unit tests for the @dw/auth package.
// No database or Redis required — all logic is deterministic.
//
// Covers:
//   roles.ts    — ROLES constants, canViewPlatform, canMutatePlatform
//   guards.ts   — hasUserId type predicate
//   errors.ts   — AUTH_ERRORS factory functions
//   metadata.ts — getRoleFromClaims
//   rbac.ts     — assertUser, assertRole, assertAdmin, assertRecruiterOrAdmin,
//                 assertPlatformMutator, assertNotBanned

import { describe, expect, it } from "vitest";

import type { AuthObject } from "../src/guards";
import { AUTH_ERRORS } from "../src/errors";
import { hasUserId } from "../src/guards";
// Importing metadata.ts activates the declare global { CustomJwtSessionClaims }
// augmentation — no separate type import needed.
import { getRoleFromClaims } from "../src/metadata";
import {
  assertAdmin,
  assertNotBanned,
  assertPlatformMutator,
  assertRecruiterOrAdmin,
  assertRole,
  assertUser,
} from "../src/rbac";
import { canMutatePlatform, canViewPlatform, ROLES } from "../src/roles";

// ─────────────────────────────────────────────
// roles.ts
// ─────────────────────────────────────────────

describe("ROLES constants", () => {
  it("exports the three role literals", () => {
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.RECRUITER).toBe("recruiter");
    expect(ROLES.USER).toBe("user");
  });
});

describe("canViewPlatform", () => {
  it("returns true for admin", () => {
    expect(canViewPlatform(ROLES.ADMIN)).toBe(true);
  });

  it("returns true for recruiter", () => {
    expect(canViewPlatform(ROLES.RECRUITER)).toBe(true);
  });

  it("returns false for user", () => {
    expect(canViewPlatform(ROLES.USER)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(canViewPlatform(undefined)).toBe(false);
  });
});

describe("canMutatePlatform", () => {
  it("returns true for admin", () => {
    expect(canMutatePlatform(ROLES.ADMIN)).toBe(true);
  });

  it("returns true for recruiter", () => {
    expect(canMutatePlatform(ROLES.RECRUITER)).toBe(true);
  });

  it("returns false for user", () => {
    expect(canMutatePlatform(ROLES.USER)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(canMutatePlatform(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// guards.ts
// ─────────────────────────────────────────────

describe("hasUserId", () => {
  it("returns true when userId is a non-empty string", () => {
    const auth = { userId: "user_abc123" } as unknown as AuthObject;
    expect(hasUserId(auth)).toBe(true);
  });

  it("returns false when userId is null", () => {
    const auth = { userId: null } as unknown as AuthObject;
    expect(hasUserId(auth)).toBe(false);
  });

  it("returns false when userId is undefined", () => {
    const auth = { userId: undefined } as unknown as AuthObject;
    expect(hasUserId(auth)).toBe(false);
  });

  it("returns false when auth object is null", () => {
    expect(hasUserId(null)).toBe(false);
  });

  it("returns false when auth object is undefined", () => {
    expect(hasUserId(undefined)).toBe(false);
  });

  it("returns false when userId is a number (wrong type)", () => {
    const auth = { userId: 42 } as unknown as AuthObject;
    expect(hasUserId(auth)).toBe(false);
  });

  it("returns false when userId key is missing entirely", () => {
    const auth = {} as unknown as AuthObject;
    expect(hasUserId(auth)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// errors.ts
// ─────────────────────────────────────────────

describe("AUTH_ERRORS", () => {
  it("UNAUTHORIZED returns TRPCError with UNAUTHORIZED code", () => {
    const err = AUTH_ERRORS.UNAUTHORIZED();
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Authentication required.");
  });

  it("FORBIDDEN returns TRPCError with FORBIDDEN code", () => {
    const err = AUTH_ERRORS.FORBIDDEN();
    expect(err.code).toBe("FORBIDDEN");
  });

  it("BANNED returns TRPCError with FORBIDDEN code", () => {
    const err = AUTH_ERRORS.BANNED();
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toContain("restricted");
  });

  it("ACCOUNT_UNAVAILABLE returns TRPCError with UNAUTHORIZED code", () => {
    const err = AUTH_ERRORS.ACCOUNT_UNAVAILABLE();
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toContain("unavailable");
  });

  it("each call returns a new error instance", () => {
    const a = AUTH_ERRORS.UNAUTHORIZED();
    const b = AUTH_ERRORS.UNAUTHORIZED();
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────
// metadata.ts
// ─────────────────────────────────────────────

describe("getRoleFromClaims", () => {
  it("returns the role from valid claims", () => {
    const claims = {
      metadata: { role: "admin" },
    } as unknown as CustomJwtSessionClaims;
    expect(getRoleFromClaims(claims)).toBe("admin");
  });

  it("returns recruiter role from claims", () => {
    const claims = {
      metadata: { role: "recruiter" },
    } as unknown as CustomJwtSessionClaims;
    expect(getRoleFromClaims(claims)).toBe("recruiter");
  });

  it("returns undefined when claims is null", () => {
    expect(getRoleFromClaims(null)).toBeUndefined();
  });

  it("returns undefined when claims is undefined", () => {
    expect(getRoleFromClaims(undefined)).toBeUndefined();
  });

  it("returns undefined when metadata.role is not set", () => {
    const claims = { metadata: {} } as unknown as CustomJwtSessionClaims;
    expect(getRoleFromClaims(claims)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// rbac.ts — assertUser
// ─────────────────────────────────────────────

describe("assertUser", () => {
  it("does not throw when user is present", () => {
    expect(() =>
      assertUser({ user: { id: "u1", role: "user" } }),
    ).not.toThrow();
  });

  it("throws UNAUTHORIZED when user is undefined", () => {
    expect(() => assertUser({ user: undefined })).toThrow();
  });

  it("throws UNAUTHORIZED when user is null", () => {
    expect(() => assertUser({ user: null })).toThrow();
  });

  it("throws UNAUTHORIZED when context is empty", () => {
    expect(() => assertUser({})).toThrow();
  });
});

// ─────────────────────────────────────────────
// rbac.ts — assertRole
// ─────────────────────────────────────────────

describe("assertRole", () => {
  it("does not throw when role matches", () => {
    expect(() =>
      assertRole({ user: { id: "u1", role: "admin" } }, "admin"),
    ).not.toThrow();
  });

  it("throws FORBIDDEN when role does not match", () => {
    expect(() =>
      assertRole({ user: { id: "u1", role: "user" } }, "admin"),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("throws UNAUTHORIZED when no user in context", () => {
    expect(() => assertRole({}, "admin")).toThrow();
  });
});

// ─────────────────────────────────────────────
// rbac.ts — assertAdmin
// ─────────────────────────────────────────────

describe("assertAdmin", () => {
  it("does not throw for admin role", () => {
    expect(() =>
      assertAdmin({ user: { id: "u1", role: "admin" } }),
    ).not.toThrow();
  });

  it("throws FORBIDDEN for recruiter role", () => {
    expect(() =>
      assertAdmin({ user: { id: "u1", role: "recruiter" } }),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("throws FORBIDDEN for user role", () => {
    expect(() => assertAdmin({ user: { id: "u1", role: "user" } })).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("throws UNAUTHORIZED when no user", () => {
    expect(() => assertAdmin({})).toThrow();
  });
});

// ─────────────────────────────────────────────
// rbac.ts — assertRecruiterOrAdmin
// ─────────────────────────────────────────────

describe("assertRecruiterOrAdmin", () => {
  it("does not throw for admin", () => {
    expect(() =>
      assertRecruiterOrAdmin({ user: { id: "u1", role: "admin" } }),
    ).not.toThrow();
  });

  it("does not throw for recruiter", () => {
    expect(() =>
      assertRecruiterOrAdmin({ user: { id: "u1", role: "recruiter" } }),
    ).not.toThrow();
  });

  it("throws FORBIDDEN for user role", () => {
    expect(() =>
      assertRecruiterOrAdmin({ user: { id: "u1", role: "user" } }),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("throws UNAUTHORIZED when no user", () => {
    expect(() => assertRecruiterOrAdmin({})).toThrow();
  });
});

// ─────────────────────────────────────────────
// rbac.ts — assertPlatformMutator
// ─────────────────────────────────────────────

describe("assertPlatformMutator", () => {
  it("does not throw for admin", () => {
    expect(() =>
      assertPlatformMutator({ user: { id: "u1", role: "admin" } }),
    ).not.toThrow();
  });

  it("does not throw for recruiter", () => {
    expect(() =>
      assertPlatformMutator({ user: { id: "u1", role: "recruiter" } }),
    ).not.toThrow();
  });

  it("throws FORBIDDEN for user role", () => {
    expect(() =>
      assertPlatformMutator({ user: { id: "u1", role: "user" } }),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("throws FORBIDDEN with platform access message for user role", () => {
    const matcher: { code: string; message: string } = {
      code: "FORBIDDEN",
      message: "Platform access required.",
    };
    expect(() =>
      assertPlatformMutator({ user: { id: "u1", role: "user" } }),
    ).toThrow(expect.objectContaining(matcher));
  });
});

// ─────────────────────────────────────────────
// rbac.ts — assertNotBanned
// ─────────────────────────────────────────────

describe("assertNotBanned", () => {
  it("does not throw when banned is false", () => {
    expect(() =>
      assertNotBanned({ user: { id: "u1", role: "user", banned: false } }),
    ).not.toThrow();
  });

  it("does not throw when banned is undefined (defaults to not banned)", () => {
    expect(() =>
      assertNotBanned({ user: { id: "u1", role: "user" } }),
    ).not.toThrow();
  });

  it("throws FORBIDDEN when banned is true", () => {
    expect(() =>
      assertNotBanned({ user: { id: "u1", role: "user", banned: true } }),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("throws UNAUTHORIZED when no user", () => {
    expect(() => assertNotBanned({})).toThrow();
  });
});
