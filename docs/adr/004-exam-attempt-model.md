# ADR 004: Exam Attempt Lifecycle and Fail-Closed Security

## Status
Accepted

## Context
High-stakes exams are susceptible to cheating, race conditions during bulk auto-submissions, and network disconnections. Students have previously attempted to view page source to extract answers or resubmit after deadlines.

## Decision
We enforce a strict fail-closed lifecycle for `ExamSession`:
1. **Server-Side Answer Scrubbing**: Student endpoints returning exam questions strip `answers`, `solutions`, and hidden test cases. Only instructors and admins receive full payloads.
2. **Terminal Status Immutability**: Once an `ExamSession` transitions to `COMPLETED` or `TERMINATED`, it is mathematically immutable. Any subsequent attempt to write answers or alter timestamps is rejected with `409 Conflict`.
3. **Dead Deadline Sweeper**: A background batch worker evaluates sessions where `now() > session.startTime + exam.duration + attemptBufferMins` and auto-terminates them if not already submitted.
4. **Client-Side Offline Buffering**: The frontend buffers answer snapshots locally in IndexedDB and syncs with idempotent updates to the backend.

## Consequences
- **Positive**: Complete prevention of answer leakage, zero answer loss during flaky WiFi, and elimination of post-deadline tampering.
- **Negative**: Requires careful synchronization logic between the client timer, local buffer, and backend deadline sweeper.
