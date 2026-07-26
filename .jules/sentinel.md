## 2026-07-25 - Prevent TOCTOU in SSRF Protections
**Vulnerability:** A Server-Side Request Forgery (SSRF) defense checked the URL hostname using DNS resolution, but then passed the original URL to `fetch()`, making it vulnerable to Time-Of-Check to Time-Of-Use (DNS rebinding) attacks.
**Learning:** Checking a hostname before fetching it does not prevent SSRF if the attacker can change the DNS record between the check and the fetch.
**Prevention:** Construct the fetch URL using the exact, validated IP address returned from the DNS lookup, and manually set the `Host` header to the original hostname to ensure correct virtual routing on the destination server.
