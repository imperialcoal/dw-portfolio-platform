import type { PlatformEvent } from "@dw/contracts";
import type { AnalysisResult } from "@dw/llm";
import {
  isAgentEmailConfigured,
  messagingEnv,
} from "@dw/validators/messaging-env";

import { getResendClient } from "./resend-client";

export interface IncidentEmailOptions {
  event: PlatformEvent;
  analysis: AnalysisResult;
  incidentDocPath?: string;
  issueUrl?: string;
}

export async function sendIncidentEmail(
  opts: IncidentEmailOptions,
): Promise<void> {
  if (!isAgentEmailConfigured()) {
    // Local/offline dev — log instead of throwing. The agent works without email.
    console.info(
      "[Agent email not configured] Incident analysis complete (no email sent):",
      {
        severity: opts.analysis.severity,
        summary: opts.analysis.summary,
        type: opts.event.type,
      },
    );
    return;
  }

  const env = messagingEnv();
  const resend = getResendClient();

  // RESEND_TO_EMAIL routes to the owner inbox — mirrors OWNER_EMAILS
  const toEmail = env.RESEND_TO_EMAIL;
  if (!toEmail) {
    console.warn(
      "[Agent email] RESEND_TO_EMAIL not set — skipping incident email.",
    );
    return;
  }

  const { subject, html } = buildEmail(opts);

  const { error } = await resend.emails.send({
    // RESEND_AGENT_FROM_EMAIL = agent@dw-portfolio.dev
    from: `Platform Agent <${String(env.RESEND_AGENT_FROM_EMAIL)}>`,
    to: toEmail,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend incident email error: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// Email template
// ─────────────────────────────────────────────

const SEVERITY_COLOR: Record<AnalysisResult["severity"], string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

const SEVERITY_EMOJI: Record<AnalysisResult["severity"], string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

function buildEmail(opts: IncidentEmailOptions): {
  subject: string;
  html: string;
} {
  const { event, analysis, incidentDocPath, issueUrl } = opts;
  const emoji = SEVERITY_EMOJI[analysis.severity];
  const color = SEVERITY_COLOR[analysis.severity];
  const label = event.type === "ci_failure" ? "CI Failure" : "Runtime Error";
  const ghRepo = process.env.GITHUB_REPO ?? "";

  const subject = `${emoji} [${analysis.severity.toUpperCase()}] ${label}: ${analysis.summary.slice(0, 60)}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;margin:0;padding:0;background:#f9fafb}
  .wrap{max-width:640px;margin:32px auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden}
  .hdr{background:${color};padding:20px 24px}
  .hdr h1{color:#fff;margin:0;font-size:18px;font-weight:600}
  .hdr p{color:rgba(255,255,255,.85);margin:4px 0 0;font-size:14px}
  .body{padding:24px}
  .sec{margin-bottom:20px}
  .sec h2{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:0 0 8px}
  .sec p{margin:0;font-size:15px;line-height:1.6}
  .code{background:#f3f4f6;border-radius:4px;padding:12px;font-family:'SF Mono',monospace;font-size:13px;line-height:1.5;white-space:pre-wrap}
  .tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .tag{background:#f3f4f6;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:500}
  .links{padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;display:flex;gap:16px}
  .link{font-size:13px;color:#2563eb;text-decoration:none}
  .foot{padding:10px 24px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head>
<body><div class="wrap">
  <div class="hdr">
    <h1>${emoji} ${label} — ${analysis.severity.toUpperCase()}</h1>
    <p>${event.service} · ${new Date().toUTCString()}</p>
  </div>
  <div class="body">
    <div class="sec"><h2>Summary</h2><p>${analysis.summary}</p></div>
    <div class="sec"><h2>Root Cause</h2><p>${analysis.rootCause}</p></div>
    <div class="sec"><h2>Impact</h2><p>${analysis.impact}</p></div>
    <div class="sec"><h2>Suggested Fix</h2><div class="code">${analysis.suggestedFix.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div></div>
    <div class="sec"><h2>Labels</h2><div class="tags">${analysis.labels.map((l) => `<span class="tag">${l}</span>`).join("")}</div></div>
  </div>
  ${
    (issueUrl ?? incidentDocPath)
      ? `
  <div class="links">
    ${issueUrl ? `<a class="link" href="${issueUrl}">→ GitHub Issue</a>` : ""}
    ${incidentDocPath && ghRepo ? `<a class="link" href="https://github.com/${ghRepo}/blob/dev/${incidentDocPath}">→ Incident Doc</a>` : ""}
  </div>`
      : ""
  }
  <div class="foot">🤖 platform-agent · dw-portfolio-platform</div>
</div></body></html>`;

  return { subject, html };
}
