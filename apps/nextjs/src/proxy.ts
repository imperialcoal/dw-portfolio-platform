// apps/nextjs/src/proxy.ts
//
// Clerk middleware with maintenance mode enforcement.
//
// Maintenance mode is stored in Redis under "platform:maintenance".
// The Edge runtime cannot use the @upstash/redis TCP client — it uses
// the Upstash REST API directly via fetch, which is Edge-compatible.
//
// Route logic:
//   /api/*        → always bypass (routes authenticate themselves)
//   /admin/*      → always bypass maintenance, require Clerk auth
//   /platform/*   → always bypass maintenance, require Clerk auth
//   everything else → if maintenance enabled, return maintenance page

import { clerkMiddleware, createRouteMatcher } from "~/auth/server";
import { env } from "~/env";

const isProtectedPage = createRouteMatcher(["/admin(.*)", "/platform(.*)"]);
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

// Admin/platform routes that bypass maintenance mode entirely
const bypassesMaintenance = createRouteMatcher([
  "/admin(.*)",
  "/platform(.*)",
  "/api/(.*)",
]);

// ─────────────────────────────────────────────
// Upstash REST client (Edge-compatible)
// Reads a single Redis key using the REST API — no TCP, no imports.
// ─────────────────────────────────────────────

interface MaintenanceRecord {
  enabled: boolean;
  message?: string;
}

async function getMaintenanceModeEdge(): Promise<MaintenanceRecord | null> {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/platform:maintenance`, {
      headers: { Authorization: `Bearer ${token}` },
      // Short cache to avoid hammering Redis on every request
      // Next.js Edge caches fetch responses for 5s by default
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { result: string | null };
    if (!data.result) return null;

    const parsed = JSON.parse(data.result) as MaintenanceRecord;
    return parsed.enabled ? parsed : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Maintenance page HTML
// Served directly from middleware — no Next.js rendering needed.
// ─────────────────────────────────────────────

function maintenancePage(message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Under Maintenance</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon {
      font-size: 2.5rem;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.025em;
      margin-bottom: 0.75rem;
      color: #fafafa;
    }
    p {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      margin-right: 0.5rem;
      animation: pulse 2s ease-in-out infinite;
    }
    .status {
      margin-top: 2rem;
      display: inline-flex;
      align-items: center;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #71717a;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔧</div>
    <h1>Under Maintenance</h1>
    <p>${message}</p>
    <div class="status">
      <span class="dot"></span>
      Maintenance in progress
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Tell browsers and CDNs not to cache the maintenance page
      "Cache-Control": "no-store, no-cache, must-revalidate",
      // Retry-After tells crawlers/clients to try again in 5 minutes
      "Retry-After": "300",
    },
  });
}

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

export default clerkMiddleware(async (auth, request) => {
  // API routes always bypass — they handle their own auth
  if (isApiRoute(request)) {
    return;
  }

  // Admin and platform routes bypass maintenance mode — always require Clerk auth
  if (isProtectedPage(request)) {
    await auth.protect();
    return;
  }

  // Public routes: check maintenance mode first
  if (!bypassesMaintenance(request)) {
    const maintenance = await getMaintenanceModeEdge();
    if (maintenance) {
      return maintenancePage(
        maintenance.message ??
          "We're performing scheduled maintenance. We'll be back shortly.",
      );
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
