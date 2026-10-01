# ADR 005: Real-Time Exam Monitoring and Telemetry via WebSockets

## Status
Accepted

## Context
High-stakes exams require live instructor oversight, including candidate connection status, active question indicators, real-time tab switch warnings, and immediate detection of dropped connections or disconnections.

## Decision
We implement a WebSocket architecture using NestJS WebSockets (`@nestjs/websockets`):
1. **Gateway**: `MonitoringGateway` establishes bidirectional Socket.io connections authenticated with the candidate's exam session JWT.
2. **Rooms**:
   - `exam:{examId}`: Instructors join to receive aggregate metrics and live violation streams.
   - `session:{sessionId}`: Candidate joins for heartbeat ping/pong and targeted proctor messages.
3. **Heartbeat & Telemetry**:
   - Client sends heartbeat every 5 seconds.
   - Server tracks presence in Redis key `presence:session:{sessionId}` with a 15-second TTL.
   - Absence of 3 consecutive heartbeats triggers a `DISCONNECTED` telemetry event on the instructor dashboard.

## Consequences
- **Positive**: Sub-second violation delivery to instructors and accurate exam room occupancy tracking.
- **Negative**: Adds stateful WebSocket connection overhead; requires Redis Pub/Sub adapter when scaling horizontally.
