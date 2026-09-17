'use client';

import React from 'react';
import Link from 'next/link';
import { useAiUsage } from '@/hooks/useAi';
import { formatCredits } from '@/lib/ai/credits';

export default function UsageMeter({ compact = false }: { compact?: boolean }) {
    const { data: usage, isLoading } = useAiUsage();

    if (isLoading || !usage) {
        return <div className={`animate-pulse rounded-lg bg-slate-100 ${compact ? 'h-5 w-28' : 'h-12 w-full'}`} />;
    }

    const { used, limit, remaining } = usage.credits;
    const unlimited = limit < 0;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
    const low = !unlimited && remaining <= Math.max(10, limit * 0.1);
    const resets = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (compact) {
        return (
            <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums ${low ? 'text-amber-700' : 'text-slate-500'}`}
                title={`${formatCredits(used)} used this month · resets ${resets}`}
            >
                <span className={`h-1.5 w-1.5 rounded-full ${low ? 'bg-amber-500' : 'bg-[var(--brand)]'}`} />
                {unlimited ? 'Unlimited credits' : `${formatCredits(remaining)} ${remaining === 1 ? 'credit' : 'credits'} left`}
            </span>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700">AI credits</span>
                <span className={`tabular-nums ${low ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                    {unlimited ? 'Unlimited' : `${formatCredits(remaining)} of ${formatCredits(limit)} left`}
                </span>
            </div>
            {!unlimited && (
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80" aria-hidden>
                    <div
                        className={`h-full rounded-full transition-[width] duration-500 ${low ? 'bg-amber-500' : 'bg-[var(--brand)]'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Resets {resets}</span>
                {low && (
                    <Link href="/dashboard/creator/billing" className="font-semibold text-[var(--brand)] hover:underline">
                        Get more
                    </Link>
                )}
            </div>
        </div>
    );
}
