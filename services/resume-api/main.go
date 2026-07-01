// dw-resume-api — Go service for AI-powered resume generation.
//
// Environment variables:
//
//	PORT             — HTTP port (default: 8080)
//	ANTHROPIC_API_KEY — required for generation endpoints
//	RESUME_API_KEY   — shared secret for X-API-Key auth (empty = disabled in dev)
//	ALLOWED_ORIGIN   — CORS allowed origin (default: *)
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/imperialcoal/dw-resume-api/api"
	ai "github.com/imperialcoal/dw-resume-api/internal/anthropic"
	"github.com/imperialcoal/dw-resume-api/internal/resume"
)

func main() {
	port := getenv("PORT", "8080")
	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")
	apiKey := os.Getenv("RESUME_API_KEY")
	allowedOrigin := getenv("ALLOWED_ORIGIN", "*")

	if anthropicKey == "" {
		log.Fatal("ANTHROPIC_API_KEY is required")
	}

	// Wire dependencies
	aiClient := ai.New(anthropicKey)
	generator := resume.NewGenerator(aiClient)
	handlers := api.NewHandlers(generator)
	router := api.NewRouter(handlers, apiKey, allowedOrigin)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 90 * time.Second, // generous for LLM calls
		IdleTimeout:  120 * time.Second,
	}

	fmt.Printf(`{"level":"info","msg":"dw-resume-api starting","port":"%s","auth":%v}`+"\n",
		port, apiKey != "")

	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
