import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';
import type { Question } from '@/app/components/Authoring/types';
import type {
    AiBrief,
    AiContentRef,
    AiConversationSummary,
    AiJob,
    AiJobKind,
    AiKind,
    AiQuality,
    AiReference,
    AiUsage,
    Blueprint,
    GeneratedQuestion,
    QuestionOp,
} from '@/lib/ai/types';

export class AiApiError extends Error {
    status: number;
    code?: string;
    resource?: string;
    feature?: string;
    requiredPlan?: string;
    limit?: number;
    current?: number;
    resetsAt?: string;

    constructor(status: number, payload: Record<string, unknown>, fallback: string) {
        const raw = payload?.message;
        const message = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(', ') : fallback;
        super(message || fallback);
        this.status = status;
        this.code = typeof payload?.code === 'string' ? payload.code : undefined;
        this.resource = typeof payload?.resource === 'string' ? payload.resource : undefined;
        this.feature = typeof payload?.feature === 'string' ? payload.feature : undefined;
        this.requiredPlan = typeof payload?.requiredPlan === 'string' ? payload.requiredPlan : undefined;
        this.limit = typeof payload?.limit === 'number' ? payload.limit : undefined;
        this.current = typeof payload?.current === 'number' ? payload.current : undefined;
        this.resetsAt = typeof payload?.resetsAt === 'string' ? payload.resetsAt : undefined;
    }
}

/** Shared by the fetch helpers here and the Studio chat transport. */
export async function buildAiHeaders(method: string, withJsonBody: boolean): Promise<HeadersInit> {
    const headers: Record<string, string> = {};
    if (withJsonBody) headers['Content-Type'] = 'application/json';
    return withClerkAuthorization(withCsrfHeader(method, headers));
}

async function aiFetch<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
    fallback = 'Request failed',
): Promise<T> {
    const method = init.method ?? 'GET';
    const hasBody = init.body !== undefined;
    const res = await apiFetch(`${API_BASE_URL}${path}`, {
        method,
        credentials: 'include',
        headers: await buildAiHeaders(method, hasBody),
        body: hasBody ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new AiApiError(res.status, payload, fallback);
    }
    return (await res.json()) as T;
}

export interface EditApplyResult {
    applied: string[];
    skipped: { id: string; summary: string; reason: string }[];
}

export interface CreateJobInput {
    kind: AiJobKind;
    brief: AiBrief;
    blueprint?: Blueprint;
    references?: AiReference[];
    quality?: AiQuality;
    conversationId?: string;
    parentJobId?: string;
}

export const AiService = {
    getUsage: () => aiFetch<AiUsage>('/ai/usage', {}, 'Could not load AI usage'),

    searchContent: (q: string) =>
        aiFetch<AiContentRef[]>(`/ai/content?q=${encodeURIComponent(q)}`, {}, 'Could not search your content'),

    createJob: (input: CreateJobInput) =>
        aiFetch<{ jobId: string; kind: AiJobKind; estimate: number; tier: string }>(
            '/ai/jobs',
            { method: 'POST', body: { references: [], ...input } },
            'Could not start the generation',
        ),

    getJob: (id: string) => aiFetch<AiJob>(`/ai/jobs/${id}`, {}, 'Could not load the generation'),

    applyEdit: (id: string, changeIds?: string[]) =>
        aiFetch<EditApplyResult>(
            `/ai/jobs/${id}/apply`,
            { method: 'POST', body: { changeIds } },
            'Could not apply the changes',
        ),

    undoEdit: (id: string) =>
        aiFetch<EditApplyResult>(`/ai/jobs/${id}/undo`, { method: 'POST', body: {} }, 'Could not undo the changes'),

    markDraftSaved: (id: string, savedAs: { kind: AiKind; id: string }) =>
        aiFetch<{ ok: boolean }>(`/ai/jobs/${id}/saved`, { method: 'POST', body: savedAs }),

    cancelJob: (id: string) =>
        aiFetch<{ id: string; status: string }>(`/ai/jobs/${id}/cancel`, { method: 'POST', body: {} }),

    questionOp: (input: {
        op: QuestionOp;
        kind: AiKind;
        question: Question;
        instruction?: string;
        references?: AiReference[];
    }) =>
        aiFetch<{ question: GeneratedQuestion; creditsUsed: number }>(
            '/ai/questions/op',
            { method: 'POST', body: { references: [], ...input } },
            'The AI action failed',
        ),

    listConversations: () => aiFetch<AiConversationSummary[]>('/ai/conversations'),

    getConversation: (id: string) =>
        aiFetch<{
            conversation: AiConversationSummary;
            messages: { id: string; role: 'user' | 'assistant' | 'system'; parts: unknown[]; metadata?: unknown }[];
            jobs: { id: string; kind: AiJobKind; status: string; parentJobId: string | null; createdAt: string }[];
        }>(`/ai/conversations/${id}`, {}, 'Could not load this chat'),

    updateConversation: (id: string, data: { title?: string; pinned?: boolean }) =>
        aiFetch<AiConversationSummary>(`/ai/conversations/${id}`, { method: 'PATCH', body: data }),

    deleteConversation: (id: string) =>
        aiFetch<{ id: string; deleted: boolean }>(`/ai/conversations/${id}`, { method: 'DELETE', body: {} }),
};
