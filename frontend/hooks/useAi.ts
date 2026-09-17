'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { AiApiError, AiService } from '@/services/api/AiService';
import type { AiJob } from '@/lib/ai/types';

export const AI_USAGE_KEY = ['ai-usage'] as const;

export function useAiUsage(enabled = true) {
    return useQuery({
        queryKey: AI_USAGE_KEY,
        queryFn: AiService.getUsage,
        enabled,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => !isPermanent(error) && failureCount < 3,
    });
}

export function useRefreshAiUsage() {
    const client = useQueryClient();
    return useCallback(() => client.invalidateQueries({ queryKey: AI_USAGE_KEY }), [client]);
}

const isActive = (job: AiJob | undefined) => job?.status === 'queued' || job?.status === 'running';

// 4xx (not allowed, not found, plan limits) won't fix themselves by retrying;
// keep retrying only network errors and 5xx.
const isPermanent = (error: unknown) => error instanceof AiApiError && error.status >= 400 && error.status < 500;

/**
 * Polls a generation job until it finishes. Polling (not streaming) keeps
 * progress working through proxies that buffer responses.
 */
export function useAiJob(jobId: string | null | undefined) {
    const refreshUsage = useRefreshAiUsage();
    return useQuery({
        queryKey: ['ai-job', jobId],
        queryFn: async () => {
            const job = await AiService.getJob(jobId as string);
            if (!isActive(job)) void refreshUsage();
            return job;
        },
        enabled: Boolean(jobId),
        retry: (failureCount, error) => !isPermanent(error) && failureCount < 3,
        // Stop polling on a permanent error: the last cached job still reads
        // "running", which would otherwise keep the interval alive forever.
        refetchInterval: (query) =>
            isActive(query.state.data as AiJob | undefined) && !isPermanent(query.state.error) ? 1500 : false,
        refetchIntervalInBackground: true,
        staleTime: (query) => (isActive(query.state.data as AiJob | undefined) ? 0 : Infinity),
    });
}
