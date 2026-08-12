## 2026-08-12 - Fix insecure Math.random() usage for test codes
**Vulnerability:** Weak random number generation using Math.random() for test codes and lock values.
**Learning:** Predictable Math.random() values can be guessed, enabling brute force or lock takeover if a seed is derived.
**Prevention:** Always use Node's native crypto module (e.g. crypto.randomInt, crypto.randomBytes) for security-sensitive tokens, codes, and locks.
