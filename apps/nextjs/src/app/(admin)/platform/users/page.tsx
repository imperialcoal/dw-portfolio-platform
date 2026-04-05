// apps/nextjs/src/app/(admin)/platform/users/page.tsx
import Link from "next/link";

import type { UserActivityRecord } from "@dw/contracts";
import { getUserActivity } from "@dw/ai/memory";
import { config } from "@dw/config";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const EVENT_STYLES: Record<
  UserActivityRecord["eventType"],
  { badge: string; label: string; icon: string }
> = {
  "user.created": {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "User Created",
    icon: "✦",
  },
  "user.deleted": {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "User Deleted",
    icon: "✕",
  },
  "user.updated": {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "User Updated",
    icon: "✎",
  },
  "session.created": {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    label: "Signed In",
    icon: "→",
  },
  "session.ended": {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    label: "Session Ended",
    icon: "←",
  },
  "oauth.connected": {
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "OAuth Connected",
    icon: "⛓",
  },
  "oauth.disconnected": {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    label: "OAuth Disconnected",
    icon: "⛓",
  },
};

// ─────────────────────────────────────────────
// Clerk deep-link builder
// URL format confirmed: /apps/{APP_ID}/instances/{INSTANCE_ID}/{path}
// ─────────────────────────────────────────────

function clerkUrl(path: string, appId: string, instanceId: string): string {
  if (!appId || !instanceId) return "https://dashboard.clerk.com";
  return `https://dashboard.clerk.com/apps/${appId}/instances/${instanceId}/${path}`;
}

function ActivityRow({
  record,
  clerkAppId,
  clerkInstanceId,
}: {
  record: UserActivityRecord;
  clerkAppId: string;
  clerkInstanceId: string;
}) {
  const style = EVENT_STYLES[record.eventType];
  const hasClerkIds = !!clerkAppId && !!clerkInstanceId;

  return (
    <div className="flex items-start gap-4 border-b border-white/5 py-3 last:border-0">
      <span
        className={`mt-0.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${style.badge}`}
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}
          >
            {style.label}
          </span>
          {record.userEmail && (
            <span className="truncate text-xs text-zinc-300">
              {record.userEmail}
            </span>
          )}
          {record.userName && (
            <span className="text-xs text-zinc-600">{record.userName}</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-[10px] text-zinc-600">
            {record.userId}
          </span>
          {record.metadata.isOwner && (
            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1 py-0.5 text-[10px] text-amber-400">
              admin
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[11px] text-zinc-600">
          {timeAgo(record.timestamp)}
        </span>
        {hasClerkIds && (
          <a
            href={clerkUrl(
              `users/${record.userId}`,
              clerkAppId,
              clerkInstanceId,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
            title="View in Clerk"
          >
            Clerk →
          </a>
        )}
      </div>
    </div>
  );
}

export default async function UsersPage() {
  const activity = await getUserActivity(100).catch(
    () => [] as UserActivityRecord[],
  );

  const clerkAppId = config.clerk.CLERK_APP_ID ?? "";
  const clerkInstanceId = config.clerk.CLERK_INSTANCE_ID ?? "";

  const createdCount = activity.filter(
    (a) => a.eventType === "user.created",
  ).length;
  const deletedCount = activity.filter(
    (a) => a.eventType === "user.deleted",
  ).length;
  const sessionCount = activity.filter(
    (a) => a.eventType === "session.created",
  ).length;

  // Clerk quick-access links — using confirmed URL format
  const clerkLinks = [
    {
      label: "All Users",
      desc: "Browse users, roles, metadata",
      href: clerkUrl("users", clerkAppId, clerkInstanceId),
    },
    {
      label: "Active Sessions",
      desc: "View and revoke live sessions",
      href: clerkUrl("sessions", clerkAppId, clerkInstanceId),
    },
    {
      label: "Audit Log",
      desc: "Full authentication event log",
      href: clerkUrl("logs", clerkAppId, clerkInstanceId),
    },
    {
      label: "Webhooks",
      desc: "Debug endpoints & signing secrets",
      href: clerkUrl("webhooks", clerkAppId, clerkInstanceId),
    },
    {
      label: "Email Templates",
      desc: "Magic link, verify, reset emails",
      href: clerkUrl(
        "customization/email-sms-templates",
        clerkAppId,
        clerkInstanceId,
      ),
    },
    {
      label: "Allowlist",
      desc: "Control approved sign-up emails/domains",
      href: clerkUrl(
        "user-authentication/restrictions/allowlist",
        clerkAppId,
        clerkInstanceId,
      ),
    },
    {
      label: "Blocklist",
      desc: "Block specific emails or identifiers",
      href: clerkUrl(
        "user-authentication/restrictions/blocklist",
        clerkAppId,
        clerkInstanceId,
      ),
    },
    {
      label: "Auth Restrictions",
      desc: "Sign-up/sign-in mode and restrictions",
      href: clerkUrl(
        "user-authentication/restrictions",
        clerkAppId,
        clerkInstanceId,
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 lg:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/platform"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              ← Platform
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                User Activity
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Auth events · Last 30 days · {activity.length} events
              </p>
            </div>
          </div>
          {/* Clerk quick-access header buttons */}
          <div className="flex shrink-0 gap-2">
            <a
              href={clerkUrl("users", clerkAppId, clerkInstanceId)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Clerk Users →
            </a>
            <a
              href={clerkUrl("webhooks", clerkAppId, clerkInstanceId)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Webhooks →
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              New Users
            </p>
            <p className="text-3xl font-bold text-green-400 tabular-nums">
              {createdCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">in window</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Sign-ins
            </p>
            <p className="text-3xl font-bold text-white tabular-nums">
              {sessionCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">successful sessions</p>
          </div>
          <div
            className={`rounded-xl border p-5 ${
              deletedCount > 0
                ? "border-red-500/20 bg-red-500/5"
                : "border-white/10 bg-white/5"
            }`}
          >
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Deleted
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                deletedCount > 0 ? "text-red-400" : "text-white"
              }`}
            >
              {deletedCount}
            </p>
            <p className="mt-1 text-xs text-zinc-600">accounts removed</p>
          </div>
        </div>

        {/* Activity timeline */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
            Activity Timeline
          </h2>
          {activity.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">No activity recorded yet.</p>
              <p className="mt-1 text-xs text-zinc-700">
                Events will appear here as users sign in or are created.
              </p>
            </div>
          ) : (
            <div>
              {activity.map((record) => (
                <ActivityRow
                  key={record.id}
                  record={record}
                  clerkAppId={clerkAppId}
                  clerkInstanceId={clerkInstanceId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Clerk Quick Access grid */}
        <div>
          <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Clerk Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {clerkLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20 hover:bg-white/10"
              >
                <p className="text-sm font-medium text-zinc-200">
                  {link.label}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">{link.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
