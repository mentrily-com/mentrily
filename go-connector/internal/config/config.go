// Package config loads go-connector settings from the environment, using the
// same variable names as the Nest backend wherever the two share a resource.
package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	Addr     string
	Features map[string]bool

	RedisURL    string
	DatabaseURL string

	// Clerk: a PEM public key (CLERK_JWT_KEY) verifies networklessly; otherwise
	// keys come from the Clerk JWKS endpoint using CLERK_SECRET_KEY.
	ClerkSecretKey string
	ClerkJWTKey    string
	ClerkAPIURL    string

	AllowedOrigins []string
	// Hostname suffixes allowed as origins (org subdomains), e.g. ".mentrily.com".
	AllowedOriginSuffixes []string
	Production            bool
}

func Load() (*Config, error) {
	c := &Config{
		Addr:           ":" + env("PORT", "4300"),
		Features:       map[string]bool{},
		RedisURL:       os.Getenv("REDIS_URL"),
		DatabaseURL:    env("DATABASE_URL", os.Getenv("SUPABASE_DIRECT_URL")),
		ClerkSecretKey: os.Getenv("CLERK_SECRET_KEY"),
		ClerkJWTKey:    os.Getenv("CLERK_JWT_KEY"),
		ClerkAPIURL:    env("CLERK_API_URL", "https://api.clerk.com"),
		Production:     os.Getenv("NODE_ENV") == "production" || os.Getenv("APP_ENV") == "production",
	}
	if c.RedisURL == "" {
		c.RedisURL = fmt.Sprintf("redis://%s:%s", env("REDIS_HOST", "localhost"), env("REDIS_PORT", "6379"))
	}
	for _, f := range list(env("FEATURES", "proctoring")) {
		c.Features[f] = true
	}

	// Mirrors backend src/config/app-brand.ts getAllowedWebOrigins.
	appURL := strings.TrimRight(env("FRONTEND_URL", env("APP_URL", env("NEXT_PUBLIC_APP_URL", "https://www.mentrily.com"))), "/")
	appDomain := "mentrily.com"
	if u, err := url.Parse(appURL); err == nil && u.Hostname() != "" {
		appDomain = strings.TrimPrefix(u.Hostname(), "www.")
	}
	c.AllowedOrigins = append(list(os.Getenv("ALLOWED_ORIGINS")), appURL, "https://"+appDomain, "https://www."+appDomain)
	if !c.Production {
		c.AllowedOrigins = append(c.AllowedOrigins, "http://localhost:3000", "http://127.0.0.1:3000", "tauri://localhost", "http://localhost:1420")
	}
	c.AllowedOriginSuffixes = []string{".mentrily.com", "." + appDomain}

	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if c.ClerkSecretKey == "" && c.ClerkJWTKey == "" {
		return nil, fmt.Errorf("CLERK_SECRET_KEY or CLERK_JWT_KEY is required")
	}
	return c, nil
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func list(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// OriginAllowed mirrors the Nest gateway CORS check: a listed origin, or a
// subdomain of mentrily.com / the app domain (https only in production).
func (c *Config) OriginAllowed(origin string) bool {
	for _, o := range c.AllowedOrigins {
		if o == origin {
			return true
		}
	}
	u, err := url.Parse(origin)
	if err != nil || (c.Production && u.Scheme != "https") {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, s := range c.AllowedOriginSuffixes {
		if strings.HasSuffix(host, s) {
			return true
		}
	}
	return false
}
