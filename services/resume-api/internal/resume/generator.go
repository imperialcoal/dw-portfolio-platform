package resume

import (
	"context"
	"fmt"

	ai "github.com/imperialcoal/dw-resume-api/internal/anthropic"
	"github.com/imperialcoal/dw-resume-api/internal/ats"
	"github.com/imperialcoal/dw-resume-api/internal/contracts"
	"github.com/imperialcoal/dw-resume-api/internal/data"
)

// Generator orchestrates resume creation for a given role.
type Generator struct {
	ai *ai.Client
}

// NewGenerator creates a new Generator.
func NewGenerator(aiClient *ai.Client) *Generator {
	return &Generator{ai: aiClient}
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

	skills := data.FilterSkillsForRole(role)
	experience := data.FilterExperienceForRole(role)

	// Convert to anthropic-local types (anthropic package knows nothing about
	// contracts or resume — this conversion is what keeps the import graph acyclic)
	input := ai.PolishInput{
		Contact:    toAIContact(data.Profile.Contact),
		Skills:     toAISkills(skills),
		Experience: toAIExperience(experience),
		Projects:   toAIProjects(data.Profile.Projects),
		Education:  toAIEducation(data.Profile.Education),
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
		Contact:    data.Profile.Contact,
		Summary:    polished.Summary,
		Skills:     polishedSkills,
		Experience: polishedExperience,
		Projects:   data.Profile.Projects,
		Education:  data.Profile.Education,
		Role:       role,
	}

	r.ATS = ats.Score(r.Summary, polishedSkills, polishedExperience, cfg.ATSKeywords, req.JobDescription)

	return r, nil
}

// ── Conversion helpers: contracts.* <-> anthropic.* ───────────────────────────
// This is the one place in the service allowed to know about both packages.

func toAIContact(c contracts.Contact) ai.Contact {
	return ai.Contact{
		Name:     c.Name,
		Location: c.Location,
		Email:    c.Email,
		LinkedIn: c.LinkedIn,
		GitHub:   c.GitHub,
	}
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
		out[i] = ai.ExperienceEntry{
			Title: e.Title, Company: e.Company, Location: e.Location,
			Start: e.Start, End: e.End, Bullets: e.Bullets,
		}
	}
	return out
}

func fromAIExperience(in []ai.ExperienceEntry) []contracts.ExperienceEntry {
	out := make([]contracts.ExperienceEntry, len(in))
	for i, e := range in {
		out[i] = contracts.ExperienceEntry{
			Title: e.Title, Company: e.Company, Location: e.Location,
			Start: e.Start, End: e.End, Bullets: e.Bullets,
		}
	}
	return out
}

func toAIProjects(in []contracts.ProjectEntry) []ai.ProjectEntry {
	out := make([]ai.ProjectEntry, len(in))
	for i, p := range in {
		out[i] = ai.ProjectEntry{
			Name: p.Name, Description: p.Description, Stack: p.Stack, Link: p.Link,
		}
	}
	return out
}

func toAIEducation(in []contracts.EducationEntry) []ai.EducationEntry {
	out := make([]ai.EducationEntry, len(in))
	for i, e := range in {
		out[i] = ai.EducationEntry{
			Degree: e.Degree, Field: e.Field, School: e.School,
			Location: e.Location, GPA: e.GPA,
		}
	}
	return out
}
