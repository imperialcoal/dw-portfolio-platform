"use server";

// Server action — proxies requests to the Go resume-api service.
// Credentials (RESUME_API_URL, RESUME_API_KEY) never leave the server.
import { env } from "~/env";

export type RoleType =
  | "frontend"
  | "backend"
  | "fullstack"
  | "platform"
  | "general";

export interface SkillGroup {
  category: string;
  skills: string[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  stack: string[];
  link?: string;
}

export interface EducationEntry {
  degree: string;
  field: string;
  school: string;
  location: string;
  gpa?: string;
}

export interface ATSAnalysis {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
}

export interface Resume {
  contact: {
    name: string;
    location: string;
    email: string;
    linkedin: string;
    github: string;
  };
  summary: string;
  skills: SkillGroup[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  ats: ATSAnalysis;
  role: RoleType;
}

export interface GenerateResult {
  resume: Resume;
  html: string;
}

function requireApiUrl(): string {
  if (!env.RESUME_API_URL) {
    throw new Error(
      "RESUME_API_URL is not configured. Set it in Doppler for this environment.",
    );
  }
  return env.RESUME_API_URL;
}

// generateResume calls the Go service to generate and render a resume.
export async function generateResume(
  role: RoleType,
  jobDescription?: string,
): Promise<GenerateResult> {
  const baseUrl = requireApiUrl();
  const apiKey = env.RESUME_API_KEY ?? "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };

  const genRes = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ role, job_description: jobDescription ?? "" }),
  });

  if (!genRes.ok) {
    const err = await genRes.text();
    throw new Error(`Resume generation failed: ${err}`);
  }

  const resume = (await genRes.json()) as Resume;

  const htmlRes = await fetch(`${baseUrl}/api/render/html`, {
    method: "POST",
    headers,
    body: JSON.stringify({ resume }),
  });

  if (!htmlRes.ok) {
    throw new Error("HTML render failed");
  }

  const { html } = (await htmlRes.json()) as { html: string };

  return { resume, html };
}

// downloadPDF fetches the PDF binary for a generated resume.
// Returns a base64-encoded string safe to pass from server → client.
export async function downloadPDF(resume: Resume): Promise<string> {
  const baseUrl = requireApiUrl();
  const apiKey = env.RESUME_API_KEY ?? "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };

  const res = await fetch(`${baseUrl}/api/render/pdf`, {
    method: "POST",
    headers,
    body: JSON.stringify({ resume }),
  });

  if (!res.ok) {
    throw new Error("PDF generation failed");
  }

  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}
