package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter(h *Handlers) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(LoggingMiddleware)
	r.Use(CORSMiddleware)

	r.Get("/health", h.Health)
	r.Get("/all", h.All)
	r.Get("/profile", h.Profile)
	r.Get("/experience", h.Experience)
	r.Get("/skills", h.Skills)
	r.Get("/projects", h.Projects)
	r.Get("/education", h.Education)

	return r
}
