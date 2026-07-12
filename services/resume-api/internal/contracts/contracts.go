// Package contracts contains pure, dependency-free shared type definitions
// used across the resume-api service. It is the Go-side counterpart to
// packages/contracts in the TypeScript monorepo: a single source of truth
// for shared shapes, imported by every other internal package, importing
// nothing internal itself. This is what keeps the dependency graph acyclic —
// internal/data, internal/resume, internal/ats, and internal/render all
// depend on contracts; contracts depends on none of them.
package contracts

// RoleType represents a target job role for resume generation.
type RoleType string

const (
	RoleFrontend  RoleType = "frontend"
	RoleBackend   RoleType = "backend"
	RoleFullstack RoleType = "fullstack"
	RolePlatform  RoleType = "platform"
	RoleGeneral   RoleType = "general"
)

// GenerateRequest is the input to POST /api/generate.
type GenerateRequest struct {
	Role           RoleType `json:"role"`
	JobDescription string   `json:"job_description,omitempty"`
}

// Contact holds the candidate's personal/contact information.
type Contact struct {
	Name     string `json:"name"`
	Location string `json:"location"`
	Email    string `json:"email"`
	LinkedIn string `json:"linkedin"`
	GitHub   string `json:"github"`
}

// SkillGroup is a named category of skills.
type SkillGroup struct {
	Category string   `json:"category"`
	Skills   []string `json:"skills"`
}

// ExperienceEntry is a single work history record.
type ExperienceEntry struct {
	Title    string   `json:"title"`
	Company  string   `json:"company"`
	Location string   `json:"location"`
	Start    string   `json:"start"`
	End      string   `json:"end"`
	Bullets  []string `json:"bullets"`
}

// EducationEntry is a single education record.
type EducationEntry struct {
	Degree   string `json:"degree"`
	Field    string `json:"field"`
	School   string `json:"school"`
	Location string `json:"location"`
	GPA      string `json:"gpa,omitempty"`
}

// ProjectEntry is a notable project or portfolio item.
type ProjectEntry struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Stack       []string `json:"stack"`
	Link        string   `json:"link,omitempty"`
}

// ATSAnalysis contains the ATS compatibility score and details.
type ATSAnalysis struct {
	Score           int      `json:"score"`
	MatchedKeywords []string `json:"matched_keywords"`
	MissingKeywords []string `json:"missing_keywords"`
	Suggestions     []string `json:"suggestions"`
}

// Resume is the complete structured resume output.
type Resume struct {
	Contact    Contact           `json:"contact"`
	Summary    string            `json:"summary"`
	Skills     []SkillGroup      `json:"skills"`
	Experience []ExperienceEntry `json:"experience"`
	Projects   []ProjectEntry    `json:"projects"`
	Education  []EducationEntry  `json:"education"`
	ATS        ATSAnalysis       `json:"ats"`
	Role       RoleType          `json:"role"`
}

// RenderRequest is the input to POST /api/render/html and /api/render/pdf.
type RenderRequest struct {
	Resume Resume `json:"resume"`
}

// ScoreRequest is the input to POST /api/score.
type ScoreRequest struct {
	Resume         Resume `json:"resume"`
	JobDescription string `json:"job_description,omitempty"`
}
