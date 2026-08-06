## 2026-08-05 - Webhook SSRF Vulnerability
**Vulnerability:** Server-Side Request Forgery (SSRF) was possible in the webhook dispatch system because it accepted arbitrary URLs from the database payload without validating the resolved IP address, enabling bypass mechanisms such as DNS rebinding or `localtest.me` pointing to `127.0.0.1`.
**Learning:** Native `fetch` lacks the ability to restrict connections based on IP range prior to connection, allowing a malicious actor to hit internal services via the backend server.
**Prevention:** Implement a custom agent utilizing `undici` to perform `dns.lookup` and explicitly reject IPs that fall within local, loopback, or private ranges using `ipaddr.js` before executing the TLS/TCP socket connection.
