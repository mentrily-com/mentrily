import { AiApiError } from '@/services/api/AiService';

export interface AiErrorView {
    title: string;
    message: string;
    /** Resolved by upgrading the plan (opens the upgrade modal). */
    upgrade: boolean;
}

const PLAN_LABEL: Record<string, string> = {
    FREE: 'Free',
    STARTER: 'Starter',
    PRO: 'Pro',
    ENTERPRISE: 'Enterprise',
};

/** The chat transport surfaces non-2xx bodies as the error message text. */
function fromUnknown(error: unknown): AiApiError | null {
    if (error instanceof AiApiError) return error;
    // Errors from the other API services carry the payload fields directly.
    const coded = error as { code?: unknown; status?: unknown; message?: unknown; payload?: unknown };
    if (error instanceof Error && typeof coded.code === 'string') {
        const payload = (coded.payload && typeof coded.payload === 'object' ? coded.payload : {}) as Record<string, unknown>;
        return new AiApiError(Number(coded.status) || 400, { ...payload, code: coded.code, message: error.message }, 'Request failed');
    }
    if (error instanceof Error) {
        try {
            const payload = JSON.parse(error.message) as Record<string, unknown>;
            if (payload && typeof payload === 'object') {
                return new AiApiError(Number(payload.statusCode) || 400, payload, 'Request failed');
            }
        } catch {
            return null;
        }
    }
    return null;
}

export function describeAiError(error: unknown): AiErrorView {
    const api = fromUnknown(error);
    if (!api) {
        return {
            title: 'Something went wrong',
            message: error instanceof Error && error.message ? error.message : 'Please try again.',
            upgrade: false,
        };
    }

    if (api.code === 'QUOTA_EXCEEDED') {
        const titles: Record<string, string> = {
            aiCreditsPerMonth: 'Out of AI credits',
            aiMessagesPerDay: 'Daily AI limit reached',
            aiMaxQuestionsPerGeneration: 'Too many questions for your plan',
            aiMaxReferences: 'Reference limit reached',
        };
        const resets =
            api.resource === 'aiCreditsPerMonth' && api.resetsAt
                ? ` Credits reset on ${new Date(api.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`
                : '';
        return {
            title: titles[api.resource ?? ''] ?? 'Plan limit reached',
            message: `${api.message}${resets} Upgrade your plan for more.`,
            upgrade: true,
        };
    }
    if (api.code === 'PLAN_FEATURE_REQUIRED') {
        const plan = api.requiredPlan ? PLAN_LABEL[api.requiredPlan] ?? api.requiredPlan : 'a higher';
        return {
            title: `Available on ${plan} plan`,
            message: api.message && api.message !== 'Request failed' ? api.message : `Upgrade to the ${plan} plan to use this.`,
            upgrade: true,
        };
    }
    if (api.code === 'AI_CONCURRENCY_LIMIT') {
        return { title: 'Generation already running', message: api.message, upgrade: false };
    }
    if (api.status === 429) {
        return {
            title: 'Slow down a little',
            message: 'Too many AI requests in a short time. Wait a moment, then try again.',
            upgrade: false,
        };
    }
    if (api.status === 503) {
        return { title: 'AI is unavailable', message: api.message, upgrade: false };
    }
    return { title: 'Something went wrong', message: api.message || 'Please try again.', upgrade: false };
}
