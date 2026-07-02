// Package contracts defines all shared types for the career-data service.
// These types are the canonical representation of career data consumed by
// the Astro portfolio (at build time) and the resume-api (at request time).
//
// Consumers deserialize JSON responses from career-data into their own
// local matching types — Go modules cannot share packages over HTTP, so
// the contract is the JSON shape, not a shared Go import.
package contracts

// Contact holds personal/contact information.
type Contact struct {
	Name     string `json:"name"`
	Location string `json:"location"`
	Email    string `json:"email"`
	LinkedIn string `json:"linkedin"`
	GitHub   string `json:"github"`
}

// Bio holds short and long form professional bio text.
type Bio struct {
	Short string `json:"short"` // one-liner for hero/meta
	Long  string `json:"long"`  // paragraph(s) for about section
}

// Profile is the top-level response for GET /profile.
type Profile struct {
	Contact   Contact `json:"contact"`
	Bio       Bio     `json:"bio"`
	Available bool    `json:"available"`
}

// TaggedExperience is a single work history entry.
// It carries both display fields (Dates, Summary, Tags for the portfolio)
// and generation fields (Start, End, Bullets, Roles, Priority for resume-api).
type TaggedExperience struct {
	Title    string   `json:"title"`
	Company  string   `json:"company"`
	Location string   `json:"location"`
	Dates    string   `json:"dates"`    // display: "Nov 2021 – Apr 2025"
	Start    string   `json:"start"`    // resume: "November 2021"
	End      string   `json:"end"`      // resume: "April 2025"
	Summary  string   `json:"summary"`  // portfolio timeline card
	Bullets  []string `json:"bullets"`  // resume generation
	Tags     []string `json:"tags"`     // brief tech pills on timeline card
	Roles    []string `json:"roles"`    // role types this entry is relevant for
	Priority int      `json:"priority"` // lower = shown first within role filter
}

// TaggedSkillGroup is a skill category with role relevance tags.
type TaggedSkillGroup struct {
	Category string   `json:"category"`
	Skills   []string `json:"skills"`
	Roles    []string `json:"roles"` // role types this category is relevant for
}

// Feature is a highlight item shown in project feature grids.
type Feature struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CTA is a call-to-action button.
type CTA struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// Project is a portfolio project with full display metadata.
type Project struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Label           string    `json:"label"` // eyebrow text: "Featured Project", "Project 02"
	Description     string    `json:"description"`
	PrimaryCTA      CTA       `json:"primary_cta"`
	SourceURL       string    `json:"source_url"`
	FeaturesHeading string    `json:"features_heading"`
	Features        []Feature `json:"features"`
	Stack           []string  `json:"stack"`
	Order           int       `json:"order"` // display order, ascending
}

// EducationEntry is a single education record.
type EducationEntry struct {
	Degree   string `json:"degree"`
	Field    string `json:"field"`
	School   string `json:"school"`
	Location string `json:"location"`
	GPA      string `json:"gpa,omitempty"`
}

// AllData is the response for GET /all — the full profile in one call.
// Astro components use this to minimize build-time round trips.
type AllData struct {
	Profile    Profile            `json:"profile"`
	Experience []TaggedExperience `json:"experience"`
	Skills     []TaggedSkillGroup `json:"skills"`
	Projects   []Project          `json:"projects"`
	Education  []EducationEntry   `json:"education"`
}
