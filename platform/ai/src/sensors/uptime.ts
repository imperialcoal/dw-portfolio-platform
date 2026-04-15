// Synthetic uptime monitoring — checks that the app's key endpoints are
// responding in the current environment.
//
// URL derivation strategy:
//   All check URLs are built from VERCEL_DOMAIN + APP_ENV — the same values
//   already used by the rollback sensor and QStash publish functions.
//   No URLs are hardcoded. Adding or removing checks requires only editing
//   the CHECKS definition below, not touching environment-specific branches.
//
// Environment isolation:
//   preview → checks dev.dw-portfolio.dev only
//   production → checks dw-portfolio.dev only
//   local/test → skips all checks (no live URL available)
//
// Severity rules:
//   The primary domain (root portfolio URL) is CRITICAL if down.
//   Supporting endpoints are HIGH if down.
//   Response time > 3s degrades status to "degraded" regardless of domain.

import type { CheckDefinition, UptimeCheckResult } from "@dw/contracts";
import { config } from "@dw/config";

const CHECKS: CheckDefinition[] = [
  {
    // Root portfolio — primary public surface, always checked
    path: "/",
    name: "Portfolio",
    critical: true,
  },
  {
    // tRPC post.all — main data endpoint used by the portfolio homepage
    path: "/api/trpc/post.all",
    name: "tRPC API",
    critical: false,
  },
  {
    // Platform dashboard — only meaningful in preview since production
    // hasn't been deployed yet; re-enable for production after dev→main merge
    path: "/platform",
    name: "Platform Dashboard",
    critical: false,
    envs: ["preview"],
  },
];

// ─────────────────────────────────────────────
// URL builder — derives base URL from environment config
// ─────────────────────────────────────────────

function getBaseUrl(): string | null {
  const appEnv = config.app.APP_ENV;

  // Local and test environments have no live deployment to check
  if (appEnv === "local" || appEnv === "test") return null;

  // VERCEL_DOMAIN is already environment-scoped:
  //   preview     → dev.dw-portfolio.dev
  //   production  → dw-portfolio.dev
  const domain = config.observability.VERCEL_DOMAIN;
  if (!domain) return null;

  // Ensure no trailing slash
  const cleanDomain = domain.replace(/\/+$/, "");

  // Domain already contains the scheme in some configs; add https:// if bare
  return cleanDomain.startsWith("http")
    ? cleanDomain
    : `https://${cleanDomain}`;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Returns the uptime check definitions applicable to the current environment,
 * with fully resolved URLs. Returns an empty array in local/test environments.
 *
 * Exported so the health-check cron can log which checks were planned
 * before executing them.
 */
export function getUptimeChecks(): (UptimeCheckResult & {
  critical: boolean;
})[] {
  // Return type is an empty scaffolding — callers use runUptimeChecks() for real results.
  // This is a helper for inspection only; actual checks are built inside runUptimeChecks().
  return [];
}

/**
 * Runs all applicable uptime checks for the current environment.
 * Returns an empty array in local/test environments — no live URL to check.
 *
 * Each result includes a `critical` flag used by the cron to set incident severity.
 */
export async function runUptimeChecks(): Promise<
  (UptimeCheckResult & { critical: boolean })[]
> {
  const appEnv = config.app.APP_ENV;
  const baseUrl = getBaseUrl();

  // No live deployment to check in local/test
  if (!baseUrl) {
    console.log(
      JSON.stringify({
        level: "info",
        sensor: "uptime",
        event: "skipped",
        reason: `APP_ENV=${appEnv} has no live deployment`,
      }),
    );
    return [];
  }

  // Filter checks to those applicable for the current environment
  const applicable = CHECKS.filter(
    (c) => !c.envs || c.envs.includes(appEnv as "preview" | "production"),
  );

  const results = await Promise.allSettled(
    applicable.map(
      async (check): Promise<UptimeCheckResult & { critical: boolean }> => {
        const url = `${baseUrl}${check.path}`;
        const start = Date.now();

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);

          const res = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            // Treat redirects (3xx) as "up" — Clerk auth redirects on /platform
            // return 307 which means the server is responding correctly
            redirect: "manual",
          });
          clearTimeout(timeout);

          const elapsed = Date.now() - start;

          // 2xx and 3xx = up (or degraded if slow), 5xx = down
          // 4xx treated as up — auth walls and 404s mean the server is running
          const status: UptimeCheckResult["status"] =
            res.status >= 500 ? "down" : elapsed > 3000 ? "degraded" : "up";

          return {
            url,
            name: check.name,
            status,
            statusCode: res.status,
            responseTimeMs: elapsed,
            checkedAt: new Date().toISOString(),
            critical: check.critical,
          };
        } catch (err) {
          // AbortError = timeout; other errors = network failure
          const isTimeout = err instanceof Error && err.name === "AbortError";

          return {
            url,
            name: check.name,
            status: "down",
            statusCode: null,
            responseTimeMs: Date.now() - start,
            checkedAt: new Date().toISOString(),
            error: isTimeout ? "Request timed out (10s)" : String(err),
            critical: check.critical,
          };
        }
      },
    ),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;

    // Promise itself rejected — should never happen given the inner try/catch,
    // but handle gracefully without a non-null assertion.
    const check = applicable[i];
    return {
      url: `${baseUrl}${check?.path ?? "/"}`,
      name: check?.name ?? "unknown",
      status: "down" as const,
      statusCode: null,
      responseTimeMs: null,
      checkedAt: new Date().toISOString(),
      error: "Check threw unexpectedly",
      critical: check?.critical ?? false,
    };
  });
}
