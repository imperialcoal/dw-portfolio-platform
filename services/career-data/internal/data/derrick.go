// Package data is the single canonical source of truth for Derrick Warren's
// career data. All other services and frontends consume this via the
// career-data HTTP API — nothing reads this package directly.
//
// To update career information: edit this file, commit, Railway auto-deploys.
// The Astro portfolio rebuilds on next Vercel deploy. The resume generator
// picks up changes on next generate request.
package data

import "github.com/imperialcoal/dw-career-data/internal/contracts"

// Profile is the complete career dataset.
var Profile = contracts.AllData{
	Profile: contracts.Profile{
		Contact: contracts.Contact{
			Name:     "Derrick Warren",
			Location: "Amelia, OH",
			Email:    "programmer.software.dwarren@gmail.com",
			LinkedIn: "linkedin.com/in/derrick-warren-794a2b203",
			GitHub:   "github.com/imperialcoal",
		},
		Bio: contracts.Bio{
			Short: "Full-Stack Software Developer with 4+ years building production TypeScript systems, AI pipelines, and cloud infrastructure.",
			Long: `I'm a software developer who arrived here through a path most resumes don't follow. Before TypeScript, I was diagnosing vehicles, managing operations teams, building computers from components, and figuring out what was actually wrong when something stopped working. That systems-thinking instinct didn't go away when I moved into software — it just found a larger surface area.

Professionally, I spent four years at MarketVision Research building and maintaining custom survey applications, shipping ECharts dashboards for non-technical stakeholders, and co-developing a VS Code extension that automated workflows across the team. Independently, I designed and built dw-portfolio-platform — the system connected to this page. It's a production-grade monorepo with a Next.js platform dashboard, tRPC API, AI agents backed by Anthropic's Claude, eight parallel CI/CD jobs, and all cloud infrastructure managed through Terraform. I built it to show, not tell.`,
		},
		Available: true,
	},

	Experience: []contracts.TaggedExperience{
		{
			Title: "Survey Programmer & Software Developer", Company: "MarketVision Research",
			Location: "Blue Ash, OH", Dates: "Nov 2021 - Apr 2025",
			Start: "November 2021", End: "April 2025",
			Summary: "Built and maintained custom market research survey applications across the full lifecycle. Shipped ECharts dashboards, custom UI components, and co-developed a VS Code extension that automated team workflows.",
			Bullets: []string{
				"Programmed and maintained custom market research survey applications using Perl, JavaScript, HTML, CSS, and proprietary .qre scripting across the full lifecycle from design through deployment and post-launch support.",
				"Built interactive data visualization dashboards using Apache ECharts, enabling non-technical stakeholders to interpret complex market research data through custom UI components.",
				"Co-developed a custom Visual Studio Code extension that automated repetitive survey programming workflows, reducing setup time across the team and improving developer productivity.",
				"Collaborated directly with clients and internal teams on requirements gathering, QA testing, and iterative delivery — communicating technical tradeoffs clearly to non-technical stakeholders.",
				"Managed deployments and post-launch maintenance across multiple concurrent survey projects using Git, Jira, and Bitbucket in a collaborative team environment.",
			},
			Tags:  []string{"Perl", "JavaScript", "HTML/CSS", "Apache ECharts", "SQL"},
			Roles: []string{"frontend", "backend", "fullstack", "platform", "general"}, Priority: 1,
		},
		{
			Title: "Technology Team Lead", Company: "Sam's Club",
			Location: "Alpharetta, GA", Dates: "Sep 2016 - Jan 2018",
			Start: "September 2016", End: "January 2018",
			Summary: "Led a team of ~10 associates across technology departments. Owned scheduling, training, onboarding, and cross-department operational coordination.",
			Bullets: []string{
				"Led a team of approximately 10 associates across technology-related departments, managing scheduling, training, onboarding, and daily operations.",
				"Coordinated cross-department inventory flow and maintained customer service standards and departmental KPIs.",
			},
			Tags:  []string{"Team Leadership", "Operations", "Training"},
			Roles: []string{"platform", "general"}, Priority: 3,
		},
		{
			Title: "General Mechanic & Office Manager", Company: "Master's Automotive",
			Location: "Marietta, GA", Dates: "Sep 2014 - Jun 2016",
			Start: "September 2014", End: "June 2016",
			Summary: "Performed vehicle diagnostics, emissions testing, brake service, and alignments while simultaneously managing front-office operations and customer communication.",
			Bullets: []string{
				"Performed vehicle diagnostics, emissions testing, brake service, wheel alignments, and routine maintenance while simultaneously managing front-office operations, customer communication, and record-keeping.",
			},
			Tags:  []string{"Diagnostics", "Office Management", "Customer Relations"},
			Roles: []string{"general"}, Priority: 4,
		},
		{
			Title: "Lead Tire Technician & Accounting Associate", Company: "Sam's Club",
			Location: "Marietta, GA", Dates: "2005 - 2014",
			Start: "2005", End: "2014",
			Summary: "Michelin and Goodyear certified tire technician. Managed inventory and reconciled financial records — dual expertise in technical service and business operations.",
			Bullets: []string{
				"Led tire installation and balancing operations holding Michelin and Goodyear technical certifications; managed inventory, special orders, and cross-department workflow.",
				"Processed financial records and reconciled accounts as an Accounting Associate, developing dual expertise in technical service and business operations.",
			},
			Tags:  []string{"Michelin Certified", "Goodyear Certified", "Accounting", "Inventory"},
			Roles: []string{"general"}, Priority: 5,
		},
		{
			Title: "Rideshare & Delivery Driver", Company: "Uber Technologies",
			Location: "Multiple States", Dates: "Nov 2015 - Present",
			Start: "November 2015", End: "Present",
			Summary: "Maintained consistent service ratings through reliability and adaptability across independent, high-volume work environments.",
			Bullets: []string{
				"Maintained consistent service ratings through reliability, professionalism, and adaptability across high-volume independent work environments.",
			},
			Tags:  []string{"Customer Service", "Adaptability"},
			Roles: []string{"general"}, Priority: 6,
		},
	},

	Skills: []contracts.TaggedSkillGroup{
		{Category: "Languages & Core", Skills: []string{"TypeScript", "JavaScript (ES2022+)", "Go", "Perl", "HTML", "CSS", "SQL", "Bash"}, Roles: []string{"frontend", "backend", "fullstack", "platform", "general"}},
		{Category: "Frontend & Frameworks", Skills: []string{"Next.js 16 (App Router)", "React 19", "Astro", "Tailwind CSS", "tRPC (client)"}, Roles: []string{"frontend", "fullstack", "general"}},
		{Category: "Backend & APIs", Skills: []string{"Node.js", "tRPC", "Drizzle ORM", "PostgreSQL", "Upstash Redis", "REST", "chi router"}, Roles: []string{"backend", "fullstack", "platform", "general"}},
		{Category: "Cloud & Infrastructure", Skills: []string{"Vercel", "Supabase", "Cloudflare", "Upstash", "Doppler", "Terraform", "Docker", "Railway"}, Roles: []string{"backend", "fullstack", "platform", "general"}},
		{Category: "Auth & Security", Skills: []string{"Clerk", "JWT", "RBAC", "webhook signature verification", "environment secret management"}, Roles: []string{"backend", "fullstack", "platform", "general"}},
		{Category: "AI & Automation", Skills: []string{"Anthropic SDK (Claude)", "AI agent control loops", "prompt engineering", "QStash", "webhook pipelines"}, Roles: []string{"backend", "fullstack", "platform", "general"}},
		{Category: "CI/CD & DevOps", Skills: []string{"GitHub Actions", "Turborepo", "pnpm Workspaces", "monorepo architecture", "ESLint 9"}, Roles: []string{"fullstack", "platform", "general"}},
		{Category: "Testing", Skills: []string{"Vitest", "integration testing", "real-infrastructure test suites", "test isolation"}, Roles: []string{"frontend", "backend", "fullstack", "general"}},
		{Category: "Data & Visualization", Skills: []string{"Apache ECharts", "survey scripting (.qre)", "QA testing", "data validation", "MySQL Workbench"}, Roles: []string{"frontend", "general"}},
		{Category: "Developer Tools", Skills: []string{"Git", "Bitbucket", "Jira", "Visual Studio Code", "Ubuntu/Linux"}, Roles: []string{"frontend", "backend", "fullstack", "platform", "general"}},
	},

	Projects: []contracts.Project{
		{
			ID: "dw-portfolio-platform", Name: "dw-portfolio-platform", Label: "Featured Project",
			Description:     "A production-grade pnpm + Turborepo monorepo: 25+ packages spanning a Next.js platform dashboard, tRPC API, Drizzle ORM, AI agent system, and full Terraform IaC. Built end-to-end as a demonstration of what I ship independently.",
			PrimaryCTA:      contracts.CTA{Label: "Try the Demo", URL: "https://dev.dw-portfolio.dev/api/demo"},
			SourceURL:       "https://github.com/imperialcoal/dw-portfolio-platform",
			FeaturesHeading: "What you'll see in the demo",
			Features: []contracts.Feature{
				{Title: "Platform Dashboard", Description: "Live AI agent output, incident tracking, system health, and deployment history — all running on real infrastructure."},
				{Title: "Role-Based Access", Description: "Sign in as a recruiter to see the demo overlay. Recruiters get scoped access to the dashboard without admin privileges."},
				{Title: "AI Agents", Description: "Five specialized agents (CI, Sentry, Security, Deps, Docs) poll sensors and write structured incident memory to Redis."},
				{Title: "Webhook Pipeline", Description: "GitHub and Sentry webhooks feed events into QStash, which dispatches async jobs to the agent layer."},
			},
			Stack: []string{"TypeScript", "Next.js 16", "tRPC", "Drizzle ORM", "Supabase", "Upstash Redis", "Anthropic SDK", "Clerk", "GitHub Actions", "Terraform", "Turborepo", "Vitest", "Docker", "Cloudflare", "Vercel"},
			Order: 1,
		},
		{
			ID: "dw-resume-api", Name: "AI Resume Generator", Label: "Project",
			Description:     "A Go microservice that generates ATS-optimized resumes via Anthropic's Claude. Select a target role and the service selects relevant experience, polishes bullet points with AI, scores the result for keyword compatibility, and renders an HTML preview plus a downloadable PDF. Deployed independently on Railway, called from a Next.js server action in the same monorepo.",
			PrimaryCTA:      contracts.CTA{Label: "Try the Demo", URL: "https://dev.dw-portfolio.dev/resume"},
			SourceURL:       "https://github.com/imperialcoal/dw-portfolio-platform/tree/dev/services/resume-api",
			FeaturesHeading: "What it does",
			Features: []contracts.Feature{
				{Title: "Role-based generation", Description: "Choose Frontend, Backend, Full-Stack, Platform, or General Engineer. Claude selects relevant experience and rewrites bullets for the target role."},
				{Title: "ATS scoring", Description: "Every resume is scored 0-100 for ATS compatibility with keyword gap analysis and actionable improvement suggestions."},
				{Title: "PDF export", Description: "Download a clean, print-ready PDF generated by the Go service using gofpdf with full UTF-8 encoding support."},
				{Title: "Go microservice", Description: "Standalone Go service deployed on Railway, called from Next.js server actions — credentials never reach the browser."},
			},
			Stack: []string{"Go", "chi router", "gofpdf", "Anthropic SDK", "TypeScript", "Next.js 16", "Railway", "Cloudflare"},
			Order: 2,
		},
	},

	Education: []contracts.EducationEntry{
		{Degree: "Associate of Applied Science", Field: "Computer Information Systems", School: "Cincinnati State Technical and Community College", Location: "Cincinnati, OH", GPA: "3.75"},
		{Degree: "Associate of Applied Science", Field: "Accounting", School: "Chattahoochee Technical College", Location: "Marietta, GA"},
	},
}
