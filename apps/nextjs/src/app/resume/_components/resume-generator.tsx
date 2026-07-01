"use client";

import { useState, useTransition } from "react";

import type { GenerateResult, RoleType } from "../_actions/generate";
import { downloadPDF, generateResume } from "../_actions/generate";

const ROLES: { id: RoleType; label: string }[] = [
  { id: "frontend", label: "Frontend Developer" },
  { id: "backend", label: "Backend Developer" },
  { id: "fullstack", label: "Full-Stack Developer" },
  { id: "platform", label: "Platform/DevOps Engineer" },
  { id: "general", label: "Software Engineer" },
];

export function ResumeGenerator() {
  const [role, setRole] = useState<RoleType>("fullstack");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await generateResume(role, jobDescription || undefined);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
      }
    });
  }

  async function handleDownloadPDF() {
    if (!result) return;
    setIsDownloading(true);
    try {
      const base64 = await downloadPDF(result.resume);
      const byteChars = atob(base64);
      const byteNumbers = new Array<number>(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `derrick-warren-resume-${role}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("PDF download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Role picker */}
      <div>
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
          Target Role
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                role === r.id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Job description (optional) */}
      <div>
        <label
          htmlFor="job-description"
          className="text-muted-foreground mb-2 block text-xs font-semibold tracking-widest uppercase"
        >
          Job Description (optional)
        </label>
        <textarea
          id="job-description"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste a job description to further tune keyword matching and ATS scoring…"
          rows={5}
          className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground w-full resize-none rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none focus:border-emerald-500/40"
        />
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate Resume"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 border-t pt-8">
          {/* ATS Score */}
          <div className="border-border bg-muted/40 rounded-xl border p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                ATS Compatibility
              </p>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  result.resume.ats.score >= 80
                    ? "text-emerald-400"
                    : result.resume.ats.score >= 60
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {result.resume.ats.score}
                <span className="text-muted-foreground text-sm">/100</span>
              </span>
            </div>
            {result.resume.ats.suggestions.length > 0 && (
              <ul className="space-y-1">
                {result.resume.ats.suggestions.map((s) => (
                  <li
                    key={s}
                    className="text-muted-foreground text-xs leading-relaxed"
                  >
                    • {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Download buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="border-border bg-muted/40 text-foreground hover:bg-muted/70 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isDownloading ? "Preparing…" : "Download PDF"}
            </button>
          </div>

          {/* HTML preview */}
          <div className="border-border overflow-hidden rounded-xl border">
            <iframe
              srcDoc={result.html}
              title="Resume preview"
              className="h-[800px] w-full bg-white"
              sandbox=""
            />
          </div>
        </div>
      )}
    </div>
  );
}
