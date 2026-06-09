// apps/nextjs/src/app/(admin)/platform/users/page.tsx
import Link from "next/link";

import type { UserActivityRecord } from "@dw/contracts";
import { getUserActivity } from "@dw/ai/memory";
import { config } from "@dw/config";

import { DEMO_TOOLTIPS, DemoDeepLink, isDemoSession } from "~/demo";

function clerkUrl(path: string, appId: string, instanceId: string) {
  if (!appId || !instanceId) return "https://dashboard.clerk.com";
  return `https://dashboard.clerk.com/apps/${appId}/instances/${instanceId}/${path}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const EVENT_STYLES: Record<
  string,
  { badge: string; icon: string; label: string }
> = {
  "user.created": {
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: "+",
    label: "created",
  },
  "user.updated": {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: "↻",
    label: "updated",
  },
  "user.deleted": {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: "x",
    label: "deleted",
  },
  "session.created": {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: "→",
    label: "signed in",
  },
  "session.ended": {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    icon: "←",
    label: "signed out",
  },
};

function ActivityRow({
  record,
  clerkAppId,
  clerkInstanceId,
  isDemo,
}: {
  record: UserActivityRecord;
  clerkAppId: string;
  clerkInstanceId: string;
  isDemo: boolean;
}) {
  const style = EVENT_STYLES[record.eventType] ?? {
    badge: "bg-muted text-muted-foreground border-border",
    icon: "·",
    label: record.eventType,
  };
  const hasClerkIds = !!clerkAppId && !!clerkInstanceId;

  return (
    <div className="border-border flex items-start gap-4 border-b py-3 last:border-0">
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
            <span className="text-foreground truncate text-xs">
              {record.userEmail}
            </span>
          )}
          {record.userName && (
            <span className="text-muted-foreground text-xs">
              {record.userName}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-[10px]">
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
        <span className="text-muted-foreground text-[11px]">
          {timeAgo(record.timestamp)}
        </span>
        {hasClerkIds && (
          <DemoDeepLink
            href={clerkUrl(
              `users/${record.userId}`,
              clerkAppId,
              clerkInstanceId,
            )}
            label="Clerk →"
            tooltip={DEMO_TOOLTIPS.clerkUsers}
            isDemo={isDemo}
            className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-2 py-0.5 text-[10px] transition-colors"
          />
        )}
      </div>
    </div>
  );
}

export default async function UsersPage() {
  const isDemo = await isDemoSession();
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

  const headerLinkClass =
    "border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded border px-3 py-1.5 text-xs transition-colors";

  const clerkLinks = [
    {
      label: "All Users",
      desc: "Browse users, roles, metadata",
      href: clerkUrl("users", clerkAppId, clerkInstanceId),
      tooltip: DEMO_TOOLTIPS.clerkUsers,
    },
    {
      label: "Active Sessions",
      desc: "View and revoke live sessions",
      href: clerkUrl("sessions", clerkAppId, clerkInstanceId),
      tooltip: DEMO_TOOLTIPS.clerkSessions,
    },
    {
      label: "Audit Log",
      desc: "Full authentication event log",
      href: clerkUrl("logs", clerkAppId, clerkInstanceId),
      tooltip: DEMO_TOOLTIPS.clerkAuditLog,
    },
    {
      label: "Webhooks",
      desc: "Debug endpoints & signing secrets",
      href: clerkUrl("webhooks", clerkAppId, clerkInstanceId),
      tooltip: DEMO_TOOLTIPS.clerkWebhooks,
    },
    {
      label: "Email Templates",
      desc: "Magic link, verify, reset emails",
      href: clerkUrl("customization/email", clerkAppId, clerkInstanceId),
      tooltip: DEMO_TOOLTIPS.clerkUsers,
    },
    {
      label: "Allowlist",
      desc: "Control approved sign-up emails/domains",
      href: clerkUrl(
        "user-authentication/restrictions/allowlist",
        clerkAppId,
        clerkInstanceId,
      ),
      tooltip: DEMO_TOOLTIPS.clerkUsers,
    },
    {
      label: "Blocklist",
      desc: "Block specific emails or identifiers",
      href: clerkUrl(
        "user-authentication/restrictions/blocklist",
        clerkAppId,
        clerkInstanceId,
      ),
      tooltip: DEMO_TOOLTIPS.clerkUsers,
    },
    {
      label: "Auth Restrictions",
      desc: "Sign-up/sign-in mode and restrictions",
      href: clerkUrl(
        "user-authentication/restrictions",
        clerkAppId,
        clerkInstanceId,
      ),
      tooltip: DEMO_TOOLTIPS.clerkUsers,
    },
  ];

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/platform"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              ← Platform
            </Link>
            <div>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                User Activity
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Auth events · Last 30 days · {activity.length} events
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <DemoDeepLink
              href={clerkUrl("users", clerkAppId, clerkInstanceId)}
              label="Clerk Users →"
              tooltip={DEMO_TOOLTIPS.clerkUsers}
              isDemo={isDemo}
              className={headerLinkClass}
            />
            <DemoDeepLink
              href={clerkUrl("webhooks", clerkAppId, clerkInstanceId)}
              label="Webhooks →"
              tooltip={DEMO_TOOLTIPS.clerkWebhooks}
              isDemo={isDemo}
              className={headerLinkClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border-border bg-muted/40 rounded-xl border p-5">
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
              New Users
            </p>
            <p className="text-3xl font-bold text-green-400 tabular-nums">
              {createdCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">in window</p>
          </div>
          <div className="border-border bg-muted/40 rounded-xl border p-5">
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
              Sign-ins
            </p>
            <p className="text-foreground text-3xl font-bold tabular-nums">
              {sessionCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              successful sessions
            </p>
          </div>
          <div
            className={`rounded-xl border p-5 ${deletedCount > 0 ? "border-red-500/20 bg-red-500/5" : "border-border bg-muted/40"}`}
          >
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-widest uppercase">
              Deleted
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${deletedCount > 0 ? "text-red-400" : "text-foreground"}`}
            >
              {deletedCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              accounts removed
            </p>
          </div>
        </div>

        <div className="border-border bg-muted/40 rounded-xl border p-6">
          <h2 className="text-muted-foreground mb-4 text-sm font-semibold tracking-widest uppercase">
            Activity Timeline
          </h2>
          {activity.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No activity recorded yet.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
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
                  isDemo={isDemo}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
            Clerk Quick Access
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {clerkLinks.map((link) => {
              const cardClass =
                "border-border bg-muted/40 hover:border-border hover:bg-muted/60 rounded-xl border p-4 transition-colors";
              if (!isDemo) {
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                  >
                    <p className="text-foreground text-sm font-medium">
                      {link.label}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {link.desc}
                    </p>
                  </a>
                );
              }
              return (
                <DemoDeepLink
                  key={link.label}
                  href={link.href}
                  label={link.label}
                  tooltip={link.tooltip}
                  isDemo={isDemo}
                  className={cardClass}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
