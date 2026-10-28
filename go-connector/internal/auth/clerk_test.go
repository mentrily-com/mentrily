package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func sign(t *testing.T, key *rsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = kid
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestVerifyWithJWKS(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	other, _ := rsa.GenerateKey(rand.Reader, 2048)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk_test" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1", "kty": "RSA",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	defer srv.Close()
	v, _ := NewVerifier("", "sk_test", srv.URL)
	ctx := context.Background()
	exp := time.Now().Add(time.Minute).Unix()

	if sub, err := v.Verify(ctx, sign(t, key, "k1", jwt.MapClaims{"sub": "user_1", "exp": exp})); err != nil || sub != "user_1" {
		t.Fatalf("valid token: sub=%q err=%v", sub, err)
	}
	cases := map[string]string{
		"wrong key":  sign(t, other, "k1", jwt.MapClaims{"sub": "user_1", "exp": exp}),
		"expired":    sign(t, key, "k1", jwt.MapClaims{"sub": "user_1", "exp": time.Now().Add(-time.Minute).Unix()}),
		"no exp":     sign(t, key, "k1", jwt.MapClaims{"sub": "user_1"}),
		"no subject": sign(t, key, "k1", jwt.MapClaims{"exp": exp}),
		"alg none":   "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyXzEifQ.",
	}
	for name, tok := range cases {
		if _, err := v.Verify(ctx, tok); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestVerifyWithStaticPEM(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	der, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
	v, err := NewVerifier(string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})), "", "")
	if err != nil {
		t.Fatal(err)
	}
	tok := sign(t, key, "any", jwt.MapClaims{"sub": "user_2", "exp": time.Now().Add(time.Minute).Unix()})
	if sub, err := v.Verify(context.Background(), tok); err != nil || sub != "user_2" {
		t.Fatalf("sub=%q err=%v", sub, err)
	}
}

func TestJWKSFailedFetchNotThrottled(t *testing.T) {
	defer func(d time.Duration) { retryAfter = d }(retryAfter)
	retryAfter = 50 * time.Millisecond
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits.Add(1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1", "kty": "RSA",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	defer srv.Close()
	v, _ := NewVerifier("", "sk_test", srv.URL)
	ctx := context.Background()
	if err := v.Prefetch(ctx); err == nil {
		t.Fatal("prefetch: want error from failing JWKS")
	}
	tok := sign(t, key, "k1", jwt.MapClaims{"sub": "user_1", "exp": time.Now().Add(time.Minute).Unix()})
	time.Sleep(2 * retryAfter)
	if sub, err := v.Verify(ctx, tok); err != nil || sub != "user_1" {
		t.Fatalf("after failed fetch: sub=%q err=%v", sub, err)
	}
	// After a success, unknown kids are throttled.
	if _, err := v.Verify(ctx, sign(t, key, "k2", jwt.MapClaims{"sub": "user_1", "exp": time.Now().Add(time.Minute).Unix()})); err == nil {
		t.Fatal("unknown kid accepted")
	}
	if n := hits.Load(); n != 2 {
		t.Fatalf("JWKS hits = %d, want 2", n)
	}
}
