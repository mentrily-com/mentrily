## 2025-02-18 - SSRF vulnerability due to external URL fetches in certificate module
**Vulnerability:** The certificate generation service fetched external images (`backgroundUrl`, `orgLogo`, `signatureUrl`) without checking if the URL resolved to an internal/private IP. This allowed SSRF (Server-Side Request Forgery). Furthermore, default behavior of following HTTP redirects and lack of IPv6 support could be leveraged to bypass initial validation.
**Learning:** Checking the hostname/URL string is insufficient, as it's vulnerable to DNS rebinding / Time-of-Check Time-of-Use (TOCTOU). Malicious actors can use a domain that initially resolves to a safe IP but later resolves to a private IP like `127.0.0.1`. Redirects and IPv6 loopback records must also be accounted for. Furthermore, resolving the hostname to an IP and replacing it in the URL string breaks SNI (Server Name Indication) for HTTPS connections.
**Prevention:**
1. Always resolve the hostname to an IP address first (e.g., using `dns.lookup`).
2. Validate that the IP is not private/local, checking both IPv4 and IPv6 loopbacks/private ranges.
3. Instead of changing the URL string, provide a custom `lookup` function in the `httpAgent`/`httpsAgent` passed to Axios. This forces Axios to connect to the previously resolved and validated IP while correctly keeping the hostname intact in the URL for SNI matching.
4. Disable HTTP redirects (e.g. `maxRedirects: 0` in axios) so that a public IP cannot suddenly redirect to `127.0.0.1` and bypass validation.
