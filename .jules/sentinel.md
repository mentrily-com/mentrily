## 2024-05-24 - SSRF in Webhook Processor
**Vulnerability:** Found a Server-Side Request Forgery (SSRF) risk in `webhook.processor.ts` where external endpoints are fetched directly using global `fetch`, allowing attackers to access internal networks or cloud metadata APIs (e.g., AWS IMDS via 169.254.169.254).
**Learning:** Node.js native `fetch` does not offer a straightforward way to intercept DNS resolution out-of-the-box, meaning string checking IP addresses before calling fetch is vulnerable to DNS rebinding.
**Prevention:** Use `undici` with a custom `Agent` dispatcher. Hook into the `connect` lifecycle, resolve DNS via `dns.lookup`, validate all IPs with `ipaddr.js` (ensuring `unicast`), and construct the TLS/net socket strictly using the validated IP address while preserving SNI.
