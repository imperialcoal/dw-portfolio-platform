package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/imperialcoal/dw-resume-api/internal/ats"
	"github.com/imperialcoal/dw-resume-api/internal/contracts"
	"github.com/imperialcoal/dw-resume-api/internal/data"
	"github.com/imperialcoal/dw-resume-api/internal/render"
	"github.com/imperialcoal/dw-resume-api/internal/resume"
)

// Handlers holds the dependencies for all HTTP handlers.
type Handlers struct {
	generator *resume.Generator
}

// NewHandlers creates a Handlers instance.
func NewHandlers(gen *resume.Generator) *Handlers {
	return &Handlers{generator: gen}
}

// Health handles GET /health.
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Roles handles GET /api/roles — returns available role types.
func (h *Handlers) Roles(w http.ResponseWriter, r *http.Request) {
	type roleInfo struct {
		ID          string `json:"id"`
		DisplayName string `json:"display_name"`
	}
	var roles []roleInfo
	order := []contracts.RoleType{
		contracts.RoleFrontend, contracts.RoleBackend, contracts.RoleFullstack,
		contracts.RolePlatform, contracts.RoleGeneral,
	}
	for _, rt := range order {
		cfg := resume.Roles[rt]
		roles = append(roles, roleInfo{ID: string(rt), DisplayName: cfg.DisplayName})
	}
	writeJSON(w, http.StatusOK, roles)
}

// Generate handles POST /api/generate.
func (h *Handlers) Generate(w http.ResponseWriter, r *http.Request) {
	var req contracts.GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	result, err := h.generator.Generate(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "generation failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// RenderHTML handles POST /api/render/html.
func (h *Handlers) RenderHTML(w http.ResponseWriter, r *http.Request) {
	var req contracts.RenderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	html, err := render.ToHTML(&req.Resume)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "html render failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"html": html})
}

// RenderPDF handles POST /api/render/pdf.
func (h *Handlers) RenderPDF(w http.ResponseWriter, r *http.Request) {
	var req contracts.RenderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	pdf, err := render.ToPDF(&req.Resume)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "pdf render failed: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="derrick-warren-resume.pdf"`)
	w.Header().Set("Content-Length", strconv.Itoa(len(pdf)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdf)
}

// Score handles POST /api/score.
func (h *Handlers) Score(w http.ResponseWriter, r *http.Request) {
	var req contracts.ScoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	role := req.Resume.Role
	cfg, ok := resume.Roles[role]
	if !ok {
		cfg = resume.Roles[contracts.RoleGeneral]
	}

	analysis := ats.Score(
		req.Resume.Summary,
		req.Resume.Skills,
		req.Resume.Experience,
		cfg.ATSKeywords,
		req.JobDescription,
	)

	writeJSON(w, http.StatusOK, analysis)
}

// Profile handles GET /api/profile.
func (h *Handlers) Profile(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, data.Profile)
}
