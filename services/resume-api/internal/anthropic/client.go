// Package anthropic wraps the Anthropic Go SDK for resume generation.
//
// This package intentionally has ZERO dependency on internal/resume.
// It defines its own local input/output types. internal/resume/generator.go
// is responsible for converting to/from these types. This keeps the
// dependency graph acyclic: resume -> anthropic, never anthropic -> resume.
package anthropic

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// Client wraps the Anthropic SDK for resume-specific operations.
type Client struct {
	client anthropic.Client
	model  anthropic.Model
}

// New creates a new Anthropic client.
// Model defaults to claude-sonnet-4-5 but can be overridden via ANTHROPIC_MODEL
// in case the pinned constant name changes between SDK versions.
func New(apiKey string) *Client {
	c := anthropic.NewClient(option.WithAPIKey(apiKey))

	modelName := os.Getenv("ANTHROPIC_MODEL")
	if modelName == "" {
		modelName = "claude-sonnet-4-5-20250929"
	}

	return &Client{
		client: c,
		model:  anthropic.Model(modelName),
	}
}

// ── Local types — anthropic package owns these, resume package converts to/from them ──

type Contact struct {
	Name     string `json:"name"`
	Location string `json:"location"`
	Email    string `json:"email"`
	LinkedIn string `json:"linkedin"`
	GitHub   string `json:"github"`
}

type SkillGroup struct {
	Category string   `json:"category"`
	Skills   []string `json:"skills"`
}

type ExperienceEntry struct {
	Title    string   `json:"title"`
	Company  string   `json:"company"`
	Location string   `json:"location"`
	Start    string   `json:"start"`
	End      string   `json:"end"`
	Bullets  []string `json:"bullets"`
}

type ProjectEntry struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Stack       []string `json:"stack"`
	Link        string   `json:"link,omitempty"`
}

type EducationEntry struct {
	Degree   string `json:"degree"`
	Field    string `json:"field"`
	School   string `json:"school"`
	Location string `json:"location"`
	GPA      string `json:"gpa,omitempty"`
}

// PolishInput is the structured base data sent to Claude.
type PolishInput struct {
	Contact    Contact
	Skills     []SkillGroup
	Experience []ExperienceEntry
	Projects   []ProjectEntry
	Education  []EducationEntry
}

// PolishOutput is the structured response from Claude.
type PolishOutput struct {
	Summary    string            `json:"summary"`
	Skills     []SkillGroup      `json:"skills"`
	Experience []ExperienceEntry `json:"experience"`
}

// RoleContext carries the role-specific guidance needed to prompt Claude,
// without anthropic needing to know about resume.RoleType or resume.RoleConfig.
type RoleContext struct {
	Role         string
	DisplayName  string
	SummaryFocus string
	ATSKeywords  []string
}

// PolishResume sends the base resume data to Claude and returns
// an AI-polished version with an optimized summary, refined bullet points,
// and ATS-tuned language for the target role.
func (c *Client) PolishResume(
	ctx context.Context,
	roleCtx RoleContext,
	input PolishInput,
	jobDescription string,
) (*PolishOutput, error) {
	systemPrompt := buildSystemPrompt()
	userPrompt := buildUserPrompt(roleCtx, input, jobDescription)

	msg, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 4000,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userPrompt)),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("anthropic request failed: %w", err)
	}

	if len(msg.Content) == 0 {
		return nil, fmt.Errorf("empty response from anthropic")
	}

	raw := extractJSON(msg.Content[0].Text)

	var out PolishOutput
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, fmt.Errorf("failed to parse anthropic response as JSON: %w\nraw: %s", err, raw)
	}

	return &out, nil
}

// extractJSON strips a markdown code fence if Claude wrapped its response in
// one, despite the system prompt instructing JSON-only output. Models
// occasionally add ```json ... ``` fences out of habit. This handles that
// gracefully rather than failing the whole request on a cosmetic wrapper.
func extractJSON(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}

	// Strip opening fence — handles ``` and ```json
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSpace(s)

	// Strip trailing fence
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

func buildSystemPrompt() string {
	return `You are a professional resume writer and ATS optimization specialist.
Your task is to take structured resume data and produce polished, role-optimized content.

You MUST respond with valid JSON only — no markdown code fences, no backticks, no preamble, no explanation. Do not wrap the JSON in ` + "```json" + ` or ` + "```" + ` under any circumstances. Output the raw JSON object and nothing else.
The JSON must match this exact structure:
{
  "summary": "string — 3-4 sentence professional summary",
  "skills": [{ "category": "string", "skills": ["string"] }],
  "experience": [{
    "title": "string",
    "company": "string",
    "location": "string",
    "start": "string",
    "end": "string",
    "bullets": ["string"]
  }]
}

Rules:
- summary: Write a compelling, specific professional summary targeted to the role. Use strong action language. Do NOT use "I" — write in third person implied (no subject).
- skills: Keep the same categories and skills provided, but reorder categories to prioritize the most relevant ones for the target role.
- experience.bullets: Rewrite each bullet with stronger action verbs and quantifiable impact where the data supports it. Do not invent metrics. Keep technical accuracy — do not remove or change technology names.
- Do not add experience entries that were not in the input.
- Do not remove experience entries.
- ATS: Naturally incorporate role-relevant keywords from the job description and role type into bullets and the summary without keyword stuffing.`
}

func buildUserPrompt(roleCtx RoleContext, input PolishInput, jobDescription string) string {
	dataJSON, _ := json.MarshalIndent(input, "", "  ")

	jdSection := ""
	if jobDescription != "" {
		jdSection = fmt.Sprintf(`
JOB DESCRIPTION TO TARGET:
%s
`, jobDescription)
	}

	return fmt.Sprintf(`TARGET ROLE: %s (%s)

SUMMARY GUIDANCE: %s

KEY ATS KEYWORDS FOR THIS ROLE: %v
%s
BASE RESUME DATA:
%s

Polish this resume data for the target role. Return valid JSON only — no code fences.`,
		roleCtx.DisplayName,
		roleCtx.Role,
		roleCtx.SummaryFocus,
		roleCtx.ATSKeywords,
		jdSection,
		string(dataJSON),
	)
}
