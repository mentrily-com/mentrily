## 2024-05-18 - SSRF Vulnerability in Webhook Dispatch
**Vulnerability:** The webhook dispatcher used native `fetch` with user-provided endpoint URLs without verifying the resolved IP addresses, making it vulnerable to Server-Side Request Forgery (SSRF) pointing to internal/private IPs.
**Learning:** Checking the hostname prefix (e.g. avoiding '127.') is insufficient due to DNS-based bypasses. Relying on `fetch` blindly trusts whatever IP the DNS resolves to.
**Prevention:** Always use a custom HTTP Agent (e.g., `undici.Agent` for native `fetch`) that hooks into `connect`, explicitly resolves the hostname via `dns.lookup`, and validates every returned IP using a robust parser like `ipaddr.js` before proceeding with the connection using the validated IP (to prevent TOCTOU).
