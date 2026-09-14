import type { AiBrief, AiGenerationType, AiQuality, Blueprint } from './types';

// Mirrors backend/src/modules/ai/engine/ai-types.ts so the UI can show a cost
// before a job starts. The server's reservation is authoritative.
const TIER_WEIGHT = { lite: 1, standard: 2, pro: 4 } as const;
const TOKENS_PER_CREDIT = 2000;
const OUTPUT_TOKENS: Record<AiGenerationType, number> = {
    MCQ: 200,
    MultiSelect: 230,
    Coding: 700,
    Web: 600,
    Reading: 500,
    Notebook: 400,
};

function credits(tier: keyof typeof TIER_WEIGHT, input: number, output: number) {
    return Math.max(1, Math.ceil(((input + output * 3) * TIER_WEIGHT[tier]) / TOKENS_PER_CREDIT));
}

export function estimateOutlineCredits(brief: Pick<AiBrief, 'sections' | 'questionsPerSection'>) {
    return credits('lite', 700, 200 + brief.sections * brief.questionsPerSection * 35);
}

export function estimateWriteCredits(blueprint: Blueprint, quality: AiQuality = 'standard') {
    const tier = quality === 'pro' ? 'pro' : 'standard';
    let total = 0;
    for (const section of blueprint.sections) {
        const output = section.questions.reduce((acc, q) => acc + OUTPUT_TOKENS[q.type], 0);
        total += credits(tier, 1200 + section.questions.length * 60, output);
    }
    const summary = blueprint.kind === 'course' ? credits('lite', 400, 400) : 0;
    return Math.ceil(total * 1.15) + summary;
}

/** Rough cost of a brief's full run (outline + writing), for early guidance. */
export function estimateBriefCredits(brief: AiBrief, quality: AiQuality = 'standard') {
    const types = brief.types.length ? brief.types : (['MCQ'] as AiGenerationType[]);
    const synthetic: Blueprint = {
        kind: brief.kind,
        title: '',
        description: '',
        sections: Array.from({ length: brief.sections }, (_, s) => ({
            id: `s${s}`,
            title: '',
            summary: '',
            questions: Array.from({ length: brief.questionsPerSection }, (_, i) => ({
                id: `q${s}-${i}`,
                type: types[i % types.length],
                title: '',
                intent: '',
                difficulty: 'Medium' as const,
                marks: 1,
            })),
        })),
    };
    return estimateOutlineCredits(brief) + estimateWriteCredits(synthetic, quality);
}

export function creditsLabel(value: number) {
    return `${value.toLocaleString()} ${value === 1 ? 'credit' : 'credits'}`;
}

export function formatCredits(value: number) {
    return value < 0 ? 'Unlimited' : value.toLocaleString();
}
