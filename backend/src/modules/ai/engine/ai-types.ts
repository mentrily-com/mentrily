export type AiTier = 'lite' | 'standard' | 'pro';

export const AI_TIERS: readonly AiTier[] = ['lite', 'standard', 'pro'];

export interface AiUsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

export const emptyUsage = (): AiUsageSnapshot => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
});

export const addUsage = (
  a: AiUsageSnapshot,
  b: AiUsageSnapshot,
): AiUsageSnapshot => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cachedTokens: a.cachedTokens + b.cachedTokens,
  totalTokens: a.totalTokens + b.totalTokens,
});

/** The caller identity every AI operation is billed and scoped to. */
export interface AiActor {
  userId: string;
  orgId: string | null;
  role: string;
}

// Credits are the user-facing unit. Output tokens cost ~3x input and cached
// input ~1/4 across the providers we route to; tiers scale the whole call.
const TIER_WEIGHT: Record<AiTier, number> = { lite: 1, standard: 2, pro: 4 };
const TOKENS_PER_CREDIT = 2000;

export function creditsForUsage(tier: AiTier, usage: AiUsageSnapshot): number {
  if (usage.totalTokens <= 0 && usage.inputTokens + usage.outputTokens <= 0) {
    return 0;
  }
  const cached = Math.min(usage.cachedTokens, usage.inputTokens);
  const weighted =
    usage.inputTokens - cached + cached * 0.25 + usage.outputTokens * 3;
  return Math.max(
    1,
    Math.ceil((weighted * TIER_WEIGHT[tier]) / TOKENS_PER_CREDIT),
  );
}

/** Upfront reservation for a call that hasn't run yet. */
export function estimateCredits(
  tier: AiTier,
  inputTokens: number,
  outputTokens: number,
): number {
  return creditsForUsage(tier, {
    inputTokens,
    outputTokens,
    cachedTokens: 0,
    totalTokens: inputTokens + outputTokens,
  });
}
