# ADR 007: AI Provider Abstraction via OmniRoute and Token Quotas

## Status
Accepted

## Context
Instructors require generative AI capabilities to create course blueprints, generate MCQ and coding assessments, and edit lessons inline. Hardcoding a single proprietary LLM provider creates vendor lock-in, exposes the platform to provider outages, and risks runaway API costs.

## Decision
We implement a multi-tiered provider routing abstraction:
1. **OmniRoute Layer**: Abstracted provider interface supporting Google Gemini, Anthropic Claude, and OpenAI-compatible models.
2. **Tier-Based Model Routing**:
   - `lite` tier (fast, inexpensive): Used for quick inline text suggestions, title generation, and tag generation (e.g. Gemini 3.8 Flash, Claude 3.5 Haiku).
   - `standard` / `pro` tier (reasoning-intensive): Used for full curriculum blueprints, complex multi-file coding challenges, and exam generation (e.g. Claude 3.5 Sonnet, Gemini 3.1 Pro).
3. **Credit Accounting & Quotas**: Each tenant/creator has an allocated monthly credit budget. `AiUsage` records tokens, provider, model, latency, and credits consumed before and after execution. Long-running jobs run asynchronously via BullMQ (`AiJob`).

## Consequences
- **Positive**: Resilience against single-provider outages, dynamic cost optimization, and predictable tenant billing.
- **Negative**: Requires maintaining prompt versioning and structured output validation across multiple model families.
