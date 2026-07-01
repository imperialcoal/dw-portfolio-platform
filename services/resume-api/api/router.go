package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter wires all routes and middleware.
func NewRouter(h *Handlers, apiKey, allowedOrigin string) http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Recoverer)
	r.Use(LoggingMiddleware)
	r.Use(CORSMiddleware(allowedOrigin))

	// Public
	r.Get("/health", h.Health)

	// Protected API routes
	r.Group(func(r chi.Router) {
		r.Use(APIKeyMiddleware(apiKey))

		r.Get("/api/roles", h.Roles)
		r.Get("/api/profile", h.Profile)
		r.Post("/api/generate", h.Generate)
		r.Post("/api/render/html", h.RenderHTML)
		r.Post("/api/render/pdf", h.RenderPDF)
		r.Post("/api/score", h.Score)
	})

	return r
}
