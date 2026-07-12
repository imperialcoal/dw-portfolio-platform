package resume

import (
	"context"
	"fmt"

	ai "github.com/imperialcoal/dw-resume-api/internal/anthropic"
	"github.com/imperialcoal/dw-resume-api/internal/ats"
	cc "github.com/imperialcoal/dw-resume-api/internal/careerclient"
	"github.com/imperialcoal/dw-resume-api/internal/contracts"
)

// Generator orchestrates resume creation for a given role.
// It fetches live career data from the career-data service on each request,
// ensuring the resume always reflects the current profile.
type Generator struct {
	ai     *ai.Client
	career *cc.Client
}

// NewGenerator creates a Generator with the given AI and career clients.
func NewGenerator(aiClient *ai.Client, careerClient *cc.Client) *Generator {
	return &Generator{ai: aiClient, career: careerClient}
}

// Generate produces a complete, AI-polished resume for the given role.
func (g *Generator) Generate(ctx context.Context, req contracts.GenerateRequest) (*contracts.Resume, error) {
	role := req.Role
	if role == "" {
		role = contracts.RoleGeneral
	}

	cfg, ok := Roles[role]
	if !ok {
		return nil, fmt.Errorf("unknown role: %s", role)
	}

	// Fetch live career data from career-data service
	profile, err := g.career.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("career data fetch failed: %w", err)
	}

	// Apply role-based filtering (business logic stays in resume-api)
	skills := cc.FilterSkillsForRole(profile.Skills, string(role))
	experience := cc.FilterExperienceForRole(profile.Experience, string(role))

	// Convert to anthropic-local types
	input := ai.PolishInput{
		Contact:    toAIContact(profile.Contact),
		Skills:     toAISkills(skills),
		Experience: toAIExperience(experience),
		Projects:   toAIProjects(profile.Projects),
		Education:  toAIEducation(profile.Education),
	}

	roleCtx := ai.RoleContext{
		Role:         string(role),
		DisplayName:  cfg.DisplayName,
		SummaryFocus: cfg.SummaryFocus,
		ATSKeywords:  cfg.ATSKeywords,
	}

	polished, err := g.ai.PolishResume(ctx, roleCtx, input, req.JobDescription)
	if err != nil {
		return nil, fmt.Errorf("ai polishing failed: %w", err)
	}

	polishedSkills := fromAISkills(polished.Skills)
	polishedExperience := fromAIExperience(polished.Experience)

	r := &contracts.Resume{
		Contact:    profile.Contact,
		Summary:    polished.Summary,
		Skills:     polishedSkills,
		Experience: polishedExperience,
		Projects:   profile.Projects,
		Education:  profile.Education,
		Role:       role,
	}

	r.ATS = ats.Score(r.Summary, polishedSkills, polishedExperience, cfg.ATSKeywords, req.JobDescription)

	return r, nil
}

// ── Conversion helpers ────────────────────────────────────────────────────────

func toAIContact(c contracts.Contact) ai.Contact {
	return ai.Contact{Name: c.Name, Location: c.Location, Email: c.Email, LinkedIn: c.LinkedIn, GitHub: c.GitHub}
}

func toAISkills(in []contracts.SkillGroup) []ai.SkillGroup {
	out := make([]ai.SkillGroup, len(in))
	for i, s := range in {
		out[i] = ai.SkillGroup{Category: s.Category, Skills: s.Skills}
	}
	return out
}

func fromAISkills(in []ai.SkillGroup) []contracts.SkillGroup {
	out := make([]contracts.SkillGroup, len(in))
	for i, s := range in {
		out[i] = contracts.SkillGroup{Category: s.Category, Skills: s.Skills}
	}
	return out
}

func toAIExperience(in []contracts.ExperienceEntry) []ai.ExperienceEntry {
	out := make([]ai.ExperienceEntry, len(in))
	for i, e := range in {
		out[i] = ai.ExperienceEntry{Title: e.Title, Company: e.Company, Location: e.Location, Start: e.Start, End: e.End, Bullets: e.Bullets}
	}
	return out
}

func fromAIExperience(in []ai.ExperienceEntry) []contracts.ExperienceEntry {
	out := make([]contracts.ExperienceEntry, len(in))
	for i, e := range in {
		out[i] = contracts.ExperienceEntry{Title: e.Title, Company: e.Company, Location: e.Location, Start: e.Start, End: e.End, Bullets: e.Bullets}
	}
	return out
}

func toAIProjects(in []contracts.ProjectEntry) []ai.ProjectEntry {
	out := make([]ai.ProjectEntry, len(in))
	for i, p := range in {
		out[i] = ai.ProjectEntry{Name: p.Name, Description: p.Description, Stack: p.Stack, Link: p.Link}
	}
	return out
}

func toAIEducation(in []contracts.EducationEntry) []ai.EducationEntry {
	out := make([]ai.EducationEntry, len(in))
	for i, e := range in {
		out[i] = ai.EducationEntry{Degree: e.Degree, Field: e.Field, School: e.School, Location: e.Location, GPA: e.GPA}
	}
	return out
}
