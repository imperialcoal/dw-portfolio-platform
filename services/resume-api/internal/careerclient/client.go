// Package careerclient fetches career profile data from the dw-career-data
// service. It replaces the previous local data package, making the resume-api
// a pure computation service with no hardcoded career content.
//
// The career-data service is the canonical source of truth. resume-api
// fetches what it needs (experience + skills) and applies role-based filtering
// locally — the filtering logic stays here because it's resume-generation
// business logic, not data.
package careerclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/imperialcoal/dw-resume-api/internal/contracts"
)

// RemoteProfile mirrors the relevant subset of what career-data returns.
// We only deserialize what resume generation needs.
type RemoteProfile struct {
	Contact    contracts.Contact          `json:"contact"`
	Experience []RemoteExperience         `json:"experience"`
	Skills     []RemoteSkillGroup         `json:"skills"`
	Projects   []contracts.ProjectEntry   `json:"projects"`
	Education  []contracts.EducationEntry `json:"education"`
}

// RemoteExperience includes role tags returned by career-data.
// Role tags allow resume-api to filter locally without a second API call.
type RemoteExperience struct {
	contracts.ExperienceEntry
	Roles    []string `json:"roles"`
	Priority int      `json:"priority"`
}

// RemoteSkillGroup includes role tags returned by career-data.
type RemoteSkillGroup struct {
	contracts.SkillGroup
	Roles []string `json:"roles"`
}

// Client fetches from the career-data service.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// New creates a Client pointed at the given base URL.
// e.g. "https://dev.career-data.dw-portfolio.dev"
func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetAll fetches the complete career profile from career-data.
func (c *Client) GetAll(ctx context.Context) (*RemoteProfile, error) {
	url := c.baseURL + "/all"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("career client: build request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("career client: fetch %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("career client: unexpected status %d from %s", resp.StatusCode, url)
	}

	// career-data returns AllData; we extract the fields we need
	var all struct {
		Profile struct {
			Contact contracts.Contact `json:"contact"`
		} `json:"profile"`
		Experience []RemoteExperience         `json:"experience"`
		Skills     []RemoteSkillGroup         `json:"skills"`
		Projects   []remoteProject            `json:"projects"`
		Education  []contracts.EducationEntry `json:"education"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&all); err != nil {
		return nil, fmt.Errorf("career client: decode response: %w", err)
	}

	// Map projects to the simpler ProjectEntry type resume-api uses
	projects := make([]contracts.ProjectEntry, len(all.Projects))
	for i, p := range all.Projects {
		projects[i] = contracts.ProjectEntry{
			Name:        p.Name,
			Description: p.Description,
			Stack:       p.Stack,
			Link:        p.SourceURL,
		}
	}

	return &RemoteProfile{
		Contact:    all.Profile.Contact,
		Experience: all.Experience,
		Skills:     all.Skills,
		Projects:   projects,
		Education:  all.Education,
	}, nil
}

// FilterSkillsForRole returns skill groups relevant to the given role.
func FilterSkillsForRole(skills []RemoteSkillGroup, role string) []contracts.SkillGroup {
	var result []contracts.SkillGroup
	seen := map[string]bool{}
	for _, sg := range skills {
		for _, r := range sg.Roles {
			if r == role && !seen[sg.Category] {
				result = append(result, sg.SkillGroup)
				seen[sg.Category] = true
				break
			}
		}
	}
	return result
}

// FilterExperienceForRole returns experience entries relevant to the given role,
// sorted by priority ascending.
func FilterExperienceForRole(experience []RemoteExperience, role string) []contracts.ExperienceEntry {
	type prioritized struct {
		entry    contracts.ExperienceEntry
		priority int
	}
	var matched []prioritized

	for _, e := range experience {
		for _, r := range e.Roles {
			if r == role {
				matched = append(matched, prioritized{e.ExperienceEntry, e.Priority})
				break
			}
		}
	}

	// Insertion sort by priority (small list, no need for sort package)
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

// remoteProject is the subset of career-data Project we need to decode.
type remoteProject struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	SourceURL   string   `json:"source_url"`
	Stack       []string `json:"stack"`
}
