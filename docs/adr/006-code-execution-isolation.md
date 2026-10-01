# ADR 006: Code Execution Isolation via Dedicated Judge0 CE

## Status
Accepted

## Context
Students submit arbitrary, untrusted source code across 30+ programming languages. Executing student code within the main NestJS runtime or on the primary application server presents severe remote code execution (RCE), fork-bomb, resource exhaustion, and lateral network traversal risks.

## Decision
We enforce strict sandboxing via an isolated **Judge0 CE** deployment:
1. **Isolated Infrastructure**: Judge0 runs on a dedicated, hardened VM outside the internal application VPC.
2. **Strict Cgroups & Namespaces**:
   - Outbound networking disabled (`enable_network: false`).
   - CPU time limit capped at 5 seconds.
   - Wall-clock time limit capped at 20 seconds.
   - Memory limit capped at 256 MB.
   - Max processes/threads capped at 64.
3. **Transport Security**: In production, communication between NestJS and Judge0 strictly requires HTTPS to protect bearer credentials in `X-Auth-Token`.

## Consequences
- **Positive**: Complete defense-in-depth against malicious code, zero risk of application crash from student submissions.
- **Negative**: Adds external network latency to compilation; requires cold-start compiler management.
