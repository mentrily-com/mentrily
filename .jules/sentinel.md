## 2026-03-08 - [SSRF Protection with Undici Custom Agents]
**Vulnerability:** The native `fetch` in Node.js processes webhooks allowing SSRF and DNS rebinding attacks because it blindly resolves hostnames during connection.
**Learning:** `undici` provides a custom `Agent` intercept via the `connect` callback. However, when binding to multiple socket events (`connect` and `error` or `secureConnect` and `error`), the `callback` might be called multiple times (e.g. if an error happens during the connection). This causes `undici` to crash the job throwing `InvalidArgumentError`.
**Prevention:** Always wrap the `callback` passed by the `undici` agent `connect` method with a `called` boolean flag to ensure it is only invoked once, regardless of how many socket events are emitted.
