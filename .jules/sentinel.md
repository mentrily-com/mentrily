
## 2025-02-17 - [CRITICAL] Prevent SSRF in Webhook Dispatcher
**Vulnerability:** The webhook dispatcher allowed Server-Side Request Forgery (SSRF) because it used global `fetch` without validating if the destination URL resolved to private or reserved IP ranges.
**Learning:** Checking the URL hostname (e.g. `url.startsWith('10.')`) is insufficient for SSRF protection because attackers can use DNS rebinding or domains like `localtest.me` that resolve to `127.0.0.1`.
**Prevention:** Always perform custom DNS resolution (using `dns.lookup`), validate the resolved IP against a library like `ipaddr.js` to ensure it falls into the `unicast` range, and inject this validated IP explicitly into the connection layer (via `undici`'s Agent). Ensure the `connect` callback is executed strictly once and the `Agent` is defined outside the job processor method to prevent memory/connection leaks.
