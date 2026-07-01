// apps/nextjs/src/app/resume/page.tsx
//
// Resume Generator — public tool.
// Allows generation of a role-optimized, ATS-tuned resume via the Go resume-api service.
// No auth required. Works in both demo and non-demo mode.

import type { Metadata } from "next";

import { ResumeGenerator } from "./_components/resume-generator";

export const metadata: Metadata = {
  title: "Resume Generator — Derrick Warren",
  description:
    "Generate an ATS-optimized resume tailored to a specific engineering role.",
};

export default function ResumePage() {
  return (
    <div className="bg-background min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10">
          <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
            Resume Generator
          </p>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Generate a tailored resume
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Select a target role. Claude will select relevant skills and
            experience, polish the wording, and score the result for ATS
            compatibility. Optionally paste a job description to tune the output
            further.
          </p>
        </div>
        <ResumeGenerator />
      </main>
    </div>
  );
}
