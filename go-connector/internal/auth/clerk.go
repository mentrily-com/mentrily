// Package auth verifies Clerk session tokens the way @clerk/backend's
// verifyToken does: RS256 signature against the instance key, exp/nbf with
// the same 5s clock skew, and a subject.
package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const clockSkew = 5 * time.Second

// After a successful JWKS fetch, unknown kids wait refreshEvery for the next
// one, so a flood of forged kids can't hammer the Clerk API. A failed fetch
// only backs off retryAfter, so a blip doesn't lock out rotated keys.
var refreshEvery, retryAfter = 30 * time.Second, 2 * time.Second

type Verifier struct {
	staticKey *rsa.PublicKey // CLERK_JWT_KEY, networkless
	secretKey string
	apiURL    string
	client    *http.Client

	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	nextFetch time.Time
	fetching  chan struct{} // closed when the in-flight fetch ends
}

func NewVerifier(pemKey, secretKey, apiURL string) (*Verifier, error) {
	v := &Verifier{secretKey: secretKey, apiURL: apiURL, keys: map[string]*rsa.PublicKey{}, client: &http.Client{Timeout: 5 * time.Second}}
	if pemKey != "" {
		k, err := jwt.ParseRSAPublicKeyFromPEM([]byte(pemKey))
		if err != nil {
			return nil, fmt.Errorf("CLERK_JWT_KEY: %w", err)
		}
		v.staticKey = k
	}
	return v, nil
}

// Verify returns the token subject (the Clerk user id).
func (v *Verifier) Verify(ctx context.Context, token string) (string, error) {
	if token == "" {
		return "", errors.New("no token")
	}
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if v.staticKey != nil {
			return v.staticKey, nil
		}
		kid, _ := t.Header["kid"].(string)
		return v.key(ctx, kid)
	}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithExpirationRequired(), jwt.WithLeeway(clockSkew))
	if err != nil {
		return "", err
	}
	sub, err := parsed.Claims.GetSubject()
	if err != nil || sub == "" {
		return "", errors.New("token has no subject")
	}
	return sub, nil
}

// Prefetch loads the JWKS so the first logins don't wait on Clerk.
func (v *Verifier) Prefetch(ctx context.Context) error {
	if v.staticKey != nil {
		return nil
	}
	return v.refresh(ctx)
}

func (v *Verifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	if k := v.cached(kid); k != nil {
		return k, nil
	}
	// Unknown kid: refetch (key rotation).
	if err := v.refresh(ctx); err != nil {
		return nil, err
	}
	if k := v.cached(kid); k != nil {
		return k, nil
	}
	return nil, fmt.Errorf("unknown signing key %q", kid)
}

func (v *Verifier) cached(kid string) *rsa.PublicKey {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.keys[kid]
}

// refresh fetches the JWKS outside the lock; concurrent callers wait for the
// one in-flight fetch instead of starting their own.
func (v *Verifier) refresh(ctx context.Context) error {
	v.mu.Lock()
	if wait := v.fetching; wait != nil {
		v.mu.Unlock()
		select {
		case <-wait:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if time.Now().Before(v.nextFetch) {
		v.mu.Unlock()
		return nil
	}
	done := make(chan struct{})
	v.fetching = done
	v.mu.Unlock()

	keys, err := v.fetchJWKS(ctx)
	v.mu.Lock()
	v.fetching = nil
	if err != nil {
		v.nextFetch = time.Now().Add(retryAfter)
	} else {
		v.keys, v.nextFetch = keys, time.Now().Add(refreshEvery)
	}
	v.mu.Unlock()
	close(done)
	return err
}

func (v *Verifier) fetchJWKS(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.apiURL+"/v1/jwks", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+v.secretKey)
	res, err := v.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch jwks: status %d", res.StatusCode)
	}
	var body struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode jwks: %w", err)
	}
	out := map[string]*rsa.PublicKey{}
	for _, k := range body.Keys {
		if k.Kty != "RSA" {
			continue
		}
		n, err1 := base64.RawURLEncoding.DecodeString(k.N)
		e, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil {
			continue
		}
		out[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	return out, nil
}
