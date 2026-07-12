package api

import (
	"encoding/json"
	"net/http"

	"github.com/imperialcoal/dw-career-data/internal/data"
)

// Handlers exposes career data over HTTP.
// All data is public — no authentication required.
type Handlers struct{}

func NewHandlers() *Handlers { return &Handlers{} }

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// All handles GET /all — returns the complete profile in one call.
// Preferred by Astro build-time fetches to minimise round trips.
func (h *Handlers) All(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile)
}

// Profile handles GET /profile — returns contact + bio.
func (h *Handlers) Profile(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile.Profile)
}

// Experience handles GET /experience — returns all work history.
// Includes role tags and priority so resume-api can filter client-side.
func (h *Handlers) Experience(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile.Experience)
}

// Skills handles GET /skills — returns all skill groups with role tags.
func (h *Handlers) Skills(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile.Skills)
}

// Projects handles GET /projects — returns portfolio projects with full metadata.
func (h *Handlers) Projects(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile.Projects)
}

// Education handles GET /education — returns education records.
func (h *Handlers) Education(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile.Education)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
