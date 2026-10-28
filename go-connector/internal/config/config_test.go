package config

import "testing"

func TestOriginAllowed(t *testing.T) {
	c := &Config{AllowedOrigins: []string{"https://www.mentrily.com"}, AllowedOriginSuffixes: []string{".mentrily.com"}, Production: true}
	for origin, want := range map[string]bool{
		"https://www.mentrily.com":  true,
		"https://acme.mentrily.com": true,
		"http://acme.mentrily.com":  false,
		"https://evilmentrily.com":  false,
		"https://mentrily.com.evil": false,
		"http://localhost:3000":     false,
	} {
		if got := c.OriginAllowed(origin); got != want {
			t.Errorf("%s: got %v want %v", origin, got, want)
		}
	}
}
