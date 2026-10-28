# go-connector

Go services that share Redis and Postgres with the Nest backend. Features are
switched on with `FEATURES` (comma-separated); today there is one:

- **`proctoring`**: the `/proctoring` Socket.IO namespace. It has the same events,
  acks, rooms, Redis keys and SQL as `backend/src/modules/monitoring/monitoring.gateway.ts`,
  so the exam client and the Nest backend work unchanged against either server.

## How it fits with Nest

| Concern | Who does it |
| --- | --- |
| Socket connections, auth, rooms, presence, violations, tab-switch terminate | go-connector |
| Answer staging (`session:answers:h:{sid}` + `ZADD NX submission:flush:due`) | go-connector |
| Flushing staged answers to Postgres + live grading | Nest `SubmissionProcessor` (drains `submission:flush:due`) |
| `forceTerminate` from teacher actions, `fetchSockets` | Nest, through the shared Socket.IO Redis adapter. It reaches sockets connected to go-connector. |

Both servers use the default `socket.io` adapter channel prefix, so they can run side by side.
`cmd/connector/adapterfix.go` patches a wire mismatch: the Go adapter omits empty
`sockets` arrays, which made Nest's `fetchSockets()` time out whenever Go replied last.

## Configuration

These use the same variable names as the backend:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4300` | |
| `FEATURES` | `proctoring` | |
| `DATABASE_URL` | (required) | The Prisma URL works as-is: `pgbouncer=true` switches to the simple protocol. |
| `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` | `redis://localhost:6379` | Must be the same Redis as Nest. |
| `CLERK_SECRET_KEY` | | Verifies tokens against Clerk JWKS (cached; refetched on an unknown `kid`, at most every 30s after a successful fetch; 2s after a failed one). |
| `CLERK_JWT_KEY` | | Optional PEM public key for networkless verification. |
| `FRONTEND_URL` / `APP_URL` / `NEXT_PUBLIC_APP_URL`, `ALLOWED_ORIGINS` | | CORS, mirroring `getAllowedWebOrigins`. |
| `NODE_ENV=production` | | https-only subdomain origins; no localhost origins. |

Frontend: `NEXT_PUBLIC_PROCTORING_WS_URL` points the exam and monitor sockets at go-connector.
`NEXT_PUBLIC_PROCTORING_TRANSPORTS=websocket,polling` enables websocket.
Leave both unset to fall back to the Nest gateway (polling).

> Run go-connector behind an endpoint that supports WebSocket (an ALB, or a direct
> host). The current API Gateway HTTP API cannot upgrade, which forces polling.
> In local load tests with 3000 candidates on 2 cores, polling used about 2x the CPU
> of WebSocket. Heartbeat p99 was 819 ms on polling versus 6 ms on WebSocket.

## Develop

```bash
go test ./...
go vet ./...
go build -o connector ./cmd/connector
docker build -t go-connector .
```

`GET /healthz` checks Redis and Postgres.
