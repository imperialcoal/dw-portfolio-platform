// Package data contains Derrick Warren's professional background
// as structured Go data. This is the source of truth used by the
// resume generator for all role-based resume generation.
package data

import "github.com/imperialcoal/dw-resume-api/internal/contracts"

// Profile is Derrick's full professional profile.
var Profile = struct {
	Contact    contracts.Contact
	Skills     []taggedSkillGroup
	Experience []taggedExperience
	Projects   []contracts.ProjectEntry
	Education  []contracts.EducationEntry
}{
	Contact: contracts.Contact{
		Name:     "Derrick Warren",
		Location: "Amelia, OH",
		Email:    "programmer.software.dwarren@gmail.com",
		LinkedIn: "linkedin.com/in/derrick-warren-794a2b203",
		GitHub:   "github.com/imperialcoal",
	},

	Skills: []taggedSkillGroup{
		{
			Group: contracts.SkillGroup{
				Category: "Languages & Core",
				Skills:   []string{"TypeScript", "JavaScript (ES2022+)", "Perl", "HTML", "CSS", "SQL", "Bash"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFrontend, contracts.RoleBackend,
				contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Frontend & Frameworks",
				Skills:   []string{"Next.js 16 (App Router)", "React 19", "Astro", "Tailwind CSS", "tRPC (client)"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFrontend, contracts.RoleFullstack, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Backend & APIs",
				Skills:   []string{"Node.js", "tRPC", "Drizzle ORM", "PostgreSQL", "Upstash Redis", "REST"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleBackend, contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Cloud & Infrastructure",
				Skills:   []string{"Vercel", "Supabase", "Cloudflare", "Upstash", "Doppler", "Terraform", "Docker"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleBackend, contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Auth & Security",
				Skills:   []string{"Clerk", "JWT", "RBAC", "webhook signature verification", "environment secret management"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleBackend, contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "AI & Automation",
				Skills:   []string{"Anthropic SDK (Claude)", "AI agent control loops", "prompt engineering", "QStash", "webhook pipelines"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleBackend, contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "CI/CD & DevOps",
				Skills:   []string{"GitHub Actions", "Turborepo", "pnpm Workspaces", "monorepo architecture", "ESLint 9"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Testing",
				Skills:   []string{"Vitest", "integration testing", "real-infrastructure test suites", "test isolation"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFrontend, contracts.RoleBackend, contracts.RoleFullstack, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Data & Visualization",
				Skills:   []string{"Apache ECharts", "survey scripting (.qre)", "QA testing", "data validation", "MySQL Workbench"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFrontend, contracts.RoleGeneral,
			},
		},
		{
			Group: contracts.SkillGroup{
				Category: "Developer Tools",
				Skills:   []string{"Git", "Bitbucket", "Jira", "Visual Studio Code", "Ubuntu/Linux"},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFrontend, contracts.RoleBackend,
				contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
		},
	},

	Experience: []taggedExperience{
		{
			Entry: contracts.ExperienceEntry{
				Title:    "Survey Programmer & Software Developer",
				Company:  "MarketVision Research",
				Location: "Blue Ash, OH",
				Start:    "November 2021",
				End:      "April 2025",
				Bullets: []string{
					"Programmed and maintained custom market research survey applications using Perl, JavaScript, HTML, CSS, and proprietary .qre scripting across the full lifecycle from design through deployment and post-launch support.",
					"Built interactive data visualization dashboards using Apache ECharts, enabling non-technical stakeholders to interpret complex market research data through custom UI components.",
					"Co-developed a custom Visual Studio Code extension that automated repetitive survey programming workflows, reducing setup time across the team and improving developer productivity.",
					"Collaborated directly with clients and internal teams on requirements gathering, QA testing, and iterative delivery — communicating technical tradeoffs clearly to non-technical stakeholders.",
					"Managed deployments and post-launch maintenance across multiple concurrent survey projects using Git, Jira, and Bitbucket in a collaborative team environment.",
				},
			},
			Roles: []contracts.RoleType{
				contracts.RoleFrontend, contracts.RoleBackend,
				contracts.RoleFullstack, contracts.RolePlatform, contracts.RoleGeneral,
			},
			Priority: 1,
		},
		{
			Entry: contracts.ExperienceEntry{
				Title:    "Technology Team Lead",
				Company:  "Sam's Club",
				Location: "Alpharetta, GA",
				Start:    "September 2016",
				End:      "January 2018",
				Bullets: []string{
					"Led a team of approximately 10 associates across technology-related departments, managing scheduling, training, onboarding, and daily operations.",
					"Coordinated cross-department inventory flow and maintained customer service standards and departmental KPIs.",
				},
			},
			Roles: []contracts.RoleType{
				contracts.RolePlatform, contracts.RoleGeneral,
			},
			Priority: 3,
		},
		{
			Entry: contracts.ExperienceEntry{
				Title:    "General Mechanic & Office Manager",
				Company:  "Master's Automotive",
				Location: "Marietta, GA",
				Start:    "September 2014",
				End:      "June 2016",
				Bullets: []string{
					"Performed vehicle diagnostics, emissions testing, brake service, wheel alignments, and routine maintenance while simultaneously managing front-office operations, customer communication, and record-keeping.",
				},
			},
			Roles:    []contracts.RoleType{contracts.RoleGeneral},
			Priority: 4,
		},
		{
			Entry: contracts.ExperienceEntry{
				Title:    "Lead Tire Technician & Accounting Associate",
				Company:  "Sam's Club",
				Location: "Marietta, GA",
				Start:    "2005",
				End:      "2014",
				Bullets: []string{
					"Led tire installation and balancing operations holding Michelin and Goodyear technical certifications; managed inventory, special orders, and cross-department workflow.",
					"Processed financial records and reconciled accounts as an Accounting Associate, developing dual expertise in technical service and business operations.",
				},
			},
			Roles:    []contracts.RoleType{contracts.RoleGeneral},
			Priority: 5,
		},
		{
			Entry: contracts.ExperienceEntry{
				Title:    "Rideshare & Delivery Driver",
				Company:  "Uber Technologies",
				Location: "Multiple States",
				Start:    "November 2015",
				End:      "Present",
				Bullets: []string{
					"Maintained consistent service ratings through reliability, professionalism, and adaptability across high-volume independent work environments.",
				},
			},
			Roles:    []contracts.RoleType{contracts.RoleGeneral},
			Priority: 6,
		},
	},

	Projects: []contracts.ProjectEntry{
		{
			Name: "dw-portfolio-platform",
			Description: "Production-grade pnpm + Turborepo monorepo featuring a Next.js platform dashboard, " +
				"tRPC API, Drizzle ORM, AI agent system backed by Anthropic's Claude, eight parallel GitHub " +
				"Actions CI/CD jobs, and full cloud infrastructure provisioned through Terraform.",
			Stack: []string{
				"TypeScript", "Next.js 16", "tRPC", "Drizzle ORM", "Supabase",
				"Upstash Redis", "Anthropic SDK", "Clerk", "GitHub Actions",
				"Terraform", "Turborepo", "Vitest", "Docker", "Cloudflare", "Vercel",
			},
			Link: "https://github.com/imperialcoal/dw-portfolio-platform",
		},
	},

	Education: []contracts.EducationEntry{
		{
			Degree:   "Associate of Applied Science",
			Field:    "Computer Information Systems",
			School:   "Cincinnati State Technical and Community College",
			Location: "Cincinnati, OH",
			GPA:      "3.75",
		},
		{
			Degree:   "Associate of Applied Science",
			Field:    "Accounting",
			School:   "Chattahoochee Technical College",
			Location: "Marietta, GA",
		},
	},
}

// taggedSkillGroup is a SkillGroup with role relevance tags.
type taggedSkillGroup struct {
	Group contracts.SkillGroup
	Roles []contracts.RoleType
}

// taggedExperience is an ExperienceEntry with role relevance tags and sort priority.
type taggedExperience struct {
	Entry    contracts.ExperienceEntry
	Roles    []contracts.RoleType
	Priority int // lower = more relevant, shown first
}

// FilterSkillsForRole returns skill groups relevant to the given role, in priority order.
func FilterSkillsForRole(role contracts.RoleType) []contracts.SkillGroup {
	var result []contracts.SkillGroup
	seen := map[string]bool{}
	for _, sg := range Profile.Skills {
		for _, r := range sg.Roles {
			if r == role && !seen[sg.Group.Category] {
				result = append(result, sg.Group)
				seen[sg.Group.Category] = true
				break
			}
		}
	}
	return result
}

// FilterExperienceForRole returns work experience relevant to the given role.
func FilterExperienceForRole(role contracts.RoleType) []contracts.ExperienceEntry {
	type prioritized struct {
		entry    contracts.ExperienceEntry
		priority int
	}
	var matched []prioritized

	for _, e := range Profile.Experience {
		for _, r := range e.Roles {
			if r == role {
				matched = append(matched, prioritized{e.Entry, e.Priority})
				break
			}
		}
	}

	for i := 1; i < len(matched); i++ {
		for j := i; j > 0 && matched[j].priority < matched[j-1].priority; j-- {
			matched[j], matched[j-1] = matched[j-1], matched[j]
		}
	}

	result := make([]contracts.ExperienceEntry, len(matched))
	for i, m := range matched {
		result[i] = m.entry
	}
	return result
}
