// Migration sensor — reads migration files from a deployment's commit
// and classifies each SQL statement by risk level.
// Pure regex classification — no LLM, no I/O beyond GitHub API.

import type {
  MigrationFile,
  MigrationOperation,
  MigrationOperationType,
  RollbackPreflight,
} from "@dw/contracts";
import { config } from "@dw/config";

const GITHUB_API = "https://api.github.com";

function getHeaders(): Record<string, string> {
  const token = config.devops.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function getRepo(): string {
  const repo = config.devops.GITHUB_REPO;
  if (!repo) throw new Error("GITHUB_REPO is not set");
  return repo;
}

// ─────────────────────────────────────────────
// SQL classifier
//
// Classifies individual SQL statements by risk.
// Destructive checked first — superset of risky.
// Anything not matched is classified as safe.
// ─────────────────────────────────────────────

const DESTRUCTIVE_PATTERNS = [
  /^\s*DROP\s+TABLE/i,
  /^\s*DROP\s+COLUMN/i,
  /^\s*DROP\s+SCHEMA/i,
  /^\s*DROP\s+DATABASE/i,
  /^\s*TRUNCATE/i,
  /^\s*DELETE\s+FROM/i,
  /ALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN/i,
];

const RISKY_PATTERNS = [
  /ALTER\s+TABLE\s+\S+\s+ALTER\s+COLUMN/i,
  /ALTER\s+TABLE\s+\S+\s+MODIFY\s+COLUMN/i,
  /ALTER\s+TABLE\s+\S+\s+RENAME\s+COLUMN/i,
  /ALTER\s+TABLE\s+\S+\s+RENAME\s+TO/i,
  /ALTER\s+TABLE\s+\S+\s+CHANGE\s+COLUMN/i,
  /^\s*RENAME\s+TABLE/i,
];

function extractTableName(sql: string): string | null {
  const patterns = [
    /(?:ALTER|DROP|CREATE|TRUNCATE)\s+TABLE\s+(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i,
    /DELETE\s+FROM\s+["'`]?(\w+)["'`]?/i,
    /RENAME\s+TABLE\s+["'`]?(\w+)["'`]?\s+TO/i,
  ];
  for (const p of patterns) {
    const m = p.exec(sql);
    if (m?.[1]) return m[1];
  }
  return null;
}

function buildDescription(
  sql: string,
  type: MigrationOperationType,
  table: string | null,
): string {
  const t = table ? ` on \`${table}\`` : "";

  if (type === "destructive") {
    if (/DROP\s+TABLE/i.test(sql))
      return `Drops table${t} — data will be permanently lost`;
    if (/DROP\s+COLUMN/i.test(sql))
      return `Drops column${t} — column data will be permanently lost`;
    if (/TRUNCATE/i.test(sql))
      return `Truncates table${t} — all rows will be deleted`;
    if (/DELETE\s+FROM/i.test(sql)) return `Deletes rows${t}`;
    return `Destructive operation${t}`;
  }

  if (type === "risky") {
    if (/ALTER.*ALTER\s+COLUMN/i.test(sql))
      return `Alters column type${t} — may fail if existing data is incompatible`;
    if (/RENAME\s+COLUMN/i.test(sql))
      return `Renames column${t} — breaks code that references old name`;
    if (/RENAME\s+TABLE|RENAME\s+TO/i.test(sql))
      return `Renames table${t} — breaks code that references old name`;
    return `Risky schema change${t}`;
  }

  if (/CREATE\s+TABLE/i.test(sql)) return `Creates new table${t}`;
  if (/ADD\s+COLUMN/i.test(sql)) return `Adds column${t} — backward compatible`;
  if (/CREATE\s+INDEX/i.test(sql))
    return `Creates index${t} — backward compatible`;
  return `Safe operation${t}`;
}

function classifyStatement(sql: string): MigrationOperation {
  const trimmed = sql.trim();
  if (!trimmed || trimmed.startsWith("--")) {
    return {
      type: "safe",
      statement: trimmed.slice(0, 200),
      table: null,
      description: "Comment or empty line",
    };
  }

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      const table = extractTableName(trimmed);
      return {
        type: "destructive",
        statement: trimmed.slice(0, 200),
        table,
        description: buildDescription(trimmed, "destructive", table),
      };
    }
  }

  for (const pattern of RISKY_PATTERNS) {
    if (pattern.test(trimmed)) {
      const table = extractTableName(trimmed);
      return {
        type: "risky",
        statement: trimmed.slice(0, 200),
        table,
        description: buildDescription(trimmed, "risky", table),
      };
    }
  }

  const table = extractTableName(trimmed);
  return {
    type: "safe",
    statement: trimmed.slice(0, 200),
    table,
    description: buildDescription(trimmed, "safe", table),
  };
}

function parseSqlStatements(content: string): string[] {
  return content
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\s*--/.exec(s));
}

function classifyFile(path: string, content: string): MigrationFile {
  const statements = parseSqlStatements(content);
  const operations = statements.map(classifyStatement);

  const riskOrder: MigrationOperationType[] = ["destructive", "risky", "safe"];
  const riskLevel =
    riskOrder.find((r) => operations.some((op) => op.type === r)) ?? "safe";

  return { path, operations, riskLevel };
}

// ─────────────────────────────────────────────
// GitHub API helpers
// ─────────────────────────────────────────────

async function getCommitFiles(sha: string): Promise<{ filename: string }[]> {
  const res = await fetch(`${GITHUB_API}/repos/${getRepo()}/commits/${sha}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { files?: { filename: string }[] };
  return data.files ?? [];
}

async function getFileContent(path: string, ref: string): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${getRepo()}/contents/${path}?ref=${ref}`,
    { headers: getHeaders() },
  );
  if (!res.ok) return "";
  const data = (await res.json()) as {
    content?: string;
    encoding?: string;
  };
  if (!data.content || data.encoding !== "base64") return "";
  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
    "utf-8",
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

/**
 * Given a deployment's commit SHA, fetches all Drizzle migration files
 * changed in that commit and classifies their SQL operations by risk.
 */
export async function analyzeDeploymentMigrations(
  deploymentId: string,
  commitSha: string,
): Promise<RollbackPreflight> {
  const files = await getCommitFiles(commitSha);

  const migrationPaths = files
    .map((f) => f.filename)
    .filter(
      (f) =>
        f.startsWith("packages/db/drizzle/") &&
        (f.endsWith(".sql") || f.endsWith(".ts")),
    );

  if (migrationPaths.length === 0) {
    return {
      deploymentId,
      commitSha,
      hasMigrations: false,
      migrations: [],
      overallRisk: "safe",
      summary: "No database migrations in this deployment.",
    };
  }

  const migrations: MigrationFile[] = [];
  for (const path of migrationPaths) {
    const content = await getFileContent(path, commitSha);
    if (content) {
      migrations.push(classifyFile(path, content));
    }
  }

  const riskOrder: MigrationOperationType[] = ["destructive", "risky", "safe"];
  const overallRisk =
    riskOrder.find((r) => migrations.some((m) => m.riskLevel === r)) ?? "safe";

  const destructiveOps = migrations.flatMap((m) =>
    m.operations.filter((op) => op.type === "destructive"),
  );
  const riskyOps = migrations.flatMap((m) =>
    m.operations.filter((op) => op.type === "risky"),
  );

  let summary: string;
  if (overallRisk === "destructive") {
    const tables = [
      ...new Set(destructiveOps.map((op) => op.table).filter(Boolean)),
    ];
    summary = `⚠ Destructive migration — ${destructiveOps.length} destructive operation${destructiveOps.length === 1 ? "" : "s"}${tables.length > 0 ? ` affecting: ${tables.join(", ")}` : ""}. Rolling back will permanently delete data.`;
  } else if (overallRisk === "risky") {
    summary = `⚠ Risky migration — ${riskyOps.length} schema change${riskyOps.length === 1 ? "" : "s"} that may affect running code. Review before rolling back.`;
  } else {
    summary = `${migrations.length} safe migration file${migrations.length === 1 ? "" : "s"} — all operations are backward compatible.`;
  }

  return {
    deploymentId,
    commitSha,
    hasMigrations: true,
    migrations,
    overallRisk,
    summary,
  };
}
