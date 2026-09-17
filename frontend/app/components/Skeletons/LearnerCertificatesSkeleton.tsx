'use client';
import React from 'react';

/**
 * Mirrors the real certificate grid in
 * app/(app)/dashboard/learner/certificates/page.tsx -- same
 * `lg:grid-cols-2 2xl:grid-cols-3` grid, same 28px card radius, and the same
 * internal blocks (award tile + title, the two DetailCards, the resource-ID
 * strip, the download button). Kept structurally identical so the real cards
 * land where their placeholders were instead of shifting the page.
 */
export default function LearnerCertificatesSkeleton({ count = 4 }: { count?: number }) {
    return (
        <section className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <article
                    key={i}
                    className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] sm:p-6"
                >
                    {/* header: award tile, kicker + title, issued-date pill */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                            <div className="min-w-0 space-y-2">
                                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                                <div className="h-5 w-44 animate-pulse rounded-md bg-slate-200" />
                            </div>
                        </div>
                        <div className="h-6 w-24 shrink-0 animate-pulse rounded-full bg-slate-100" />
                    </div>

                    {/* the two DetailCards */}
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {[0, 1].map((d) => (
                            <div key={d} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                                <div className="mt-2 h-6 w-14 animate-pulse rounded-md bg-slate-200" />
                            </div>
                        ))}
                    </div>

                    {/* resource id strip */}
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                    </div>

                    {/* download button */}
                    <div className="mt-6 h-11 w-full animate-pulse rounded-xl bg-slate-200" />
                </article>
            ))}
        </section>
    );
}
