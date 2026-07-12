// dw-career-data — canonical career content API.
//
// Serves Derrick Warren's career data as structured JSON consumed by
// the Astro portfolio (at Vercel build time) and the resume-api Go service
// (per generate request). One source of truth; every consumer derives from it.
//
// Environment variables:
//
//	PORT — HTTP port (default: 8080)
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/imperialcoal/dw-career-data/api"
)

func main() {
	port := getenv("PORT", "8080")

	handlers := api.NewHandlers()
	router := api.NewRouter(handlers)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	fmt.Printf(`{"level":"info","msg":"dw-career-data starting","port":"%s"}`+"\n", port)

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
