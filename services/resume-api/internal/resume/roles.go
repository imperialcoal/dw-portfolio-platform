package resume

import "github.com/imperialcoal/dw-resume-api/internal/contracts"

// RoleConfig defines what to emphasize for a given target role.
// This stays in package resume (not contracts) deliberately — it's business
// orchestration config (what to tell the LLM), not a wire/shared data shape.
type RoleConfig struct {
	DisplayName   string
	ATSKeywords   []string // keywords ATS scanners look for in this role
	SkillPriority []string // skill category names to list first
	SummaryFocus  string   // guidance passed to the LLM for summary writing
}

// Roles is the registry of supported role configurations.
var Roles = map[contracts.RoleType]RoleConfig{
	contracts.RoleFrontend: {
		DisplayName: "Frontend Developer",
		ATSKeywords: []string{
			"React", "Next.js", "TypeScript", "JavaScript", "HTML", "CSS",
			"Tailwind CSS", "UI/UX", "component library", "responsive design",
			"state management", "REST API", "GraphQL", "webpack", "Vite",
			"performance optimization", "accessibility", "WCAG", "testing",
			"cross-browser", "mobile-first",
		},
		SkillPriority: []string{
			"Frontend & Frameworks", "Languages & Core", "Testing",
		},
		SummaryFocus: "Emphasize UI/UX skills, React/Next.js expertise, component architecture, " +
			"and experience building responsive, accessible interfaces. Highlight data visualization work.",
	},
	contracts.RoleBackend: {
		DisplayName: "Backend Developer",
		ATSKeywords: []string{
			"Node.js", "Go", "TypeScript", "REST API", "tRPC", "PostgreSQL",
			"Redis", "Drizzle ORM", "SQL", "database design", "API design",
			"microservices", "authentication", "authorization", "caching",
			"webhooks", "message queues", "Supabase", "Docker", "Linux",
			"performance", "scalability", "security",
		},
		SkillPriority: []string{
			"Backend & APIs", "Cloud & Infrastructure", "Languages & Core",
		},
		SummaryFocus: "Emphasize API design, database work, caching strategies, authentication systems, " +
			"and backend performance. Highlight tRPC, Drizzle ORM, and Redis experience.",
	},
	contracts.RoleFullstack: {
		DisplayName: "Full-Stack Developer",
		ATSKeywords: []string{
			"TypeScript", "React", "Next.js", "Node.js", "tRPC", "PostgreSQL",
			"Redis", "REST API", "full-stack", "frontend", "backend",
			"database", "authentication", "Tailwind CSS", "SQL", "Docker",
			"CI/CD", "GitHub Actions", "testing", "Vitest", "Supabase",
		},
		SkillPriority: []string{
			"Frontend & Frameworks", "Backend & APIs", "Cloud & Infrastructure",
		},
		SummaryFocus: "Emphasize end-to-end ownership across the full stack. Highlight the ability " +
			"to build complete features from UI through database, and experience owning entire " +
			"product surfaces independently.",
	},
	contracts.RolePlatform: {
		DisplayName: "Platform/DevOps Engineer",
		ATSKeywords: []string{
			"Terraform", "IaC", "infrastructure as code", "CI/CD", "GitHub Actions",
			"Docker", "Kubernetes", "Vercel", "Cloudflare", "Supabase", "Upstash",
			"Doppler", "Redis", "monitoring", "observability", "Sentry",
			"deployment", "pnpm", "Turborepo", "monorepo", "automation",
			"security", "secrets management", "environment configuration",
			"TypeScript", "Bash", "Linux",
		},
		SkillPriority: []string{
			"Cloud & Infrastructure", "CI/CD & DevOps", "AI & Automation",
		},
		SummaryFocus: "Emphasize infrastructure-as-code, CI/CD pipeline design, cloud service orchestration, " +
			"monorepo management, and automation systems. Highlight Terraform, GitHub Actions, and " +
			"multi-environment deployment experience.",
	},
	contracts.RoleGeneral: {
		DisplayName: "Software Engineer",
		ATSKeywords: []string{
			"TypeScript", "JavaScript", "React", "Node.js", "SQL", "PostgreSQL",
			"Git", "GitHub", "CI/CD", "testing", "API", "database", "Docker",
			"agile", "collaboration", "problem solving", "full-stack",
			"software development lifecycle", "SDLC", "code review",
		},
		SkillPriority: []string{
			"Languages & Core", "Frontend & Frameworks", "Cloud & Infrastructure",
		},
		SummaryFocus: "Present a broad, well-rounded engineering profile. Highlight versatility across " +
			"frontend, backend, and infrastructure. Emphasize the ability to own features end-to-end " +
			"and learn new technologies quickly.",
	},
}
