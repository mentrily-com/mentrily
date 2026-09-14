'use client';
import React from 'react';

/**
 * Exact DOM structure matching app/(app)/dashboard/learner/browse/page.tsx:
 * - Same outer container (min-h-screen bg-slate-50 text-slate-900 font-sans)
 * - Same main wrapper (max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10)
 * - Same header block: Title ("Browse Courses"), subtitle, and search input box
 * - Same disclaimer paragraph placeholder
 * - Same 3-column course card grid with thumbnail, title, description, and action button
 */
export default function LearnerBrowseSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
                {/* Header & Search Bar */}
                <div className="flex flex-col gap-4 mb-6 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse" />
                        <div className="h-3.5 w-64 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="h-11 w-full rounded-2xl bg-slate-200/80 animate-pulse sm:w-72" />
                </div>

                {/* Disclaimer banner */}
                <div className="mb-6 -mt-3 space-y-1.5 sm:mb-10 max-w-2xl">
                    <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-slate-100 animate-pulse" />
                </div>

                {/* Course Cards Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: count }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-slate-100 bg-white p-0 shadow-sm overflow-hidden"
                        >
                            <div className="h-40 w-full bg-slate-100 animate-pulse" />
                            <div className="p-5 space-y-3">
                                <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
                                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                                <div className="h-9 w-full bg-slate-100 rounded-2xl animate-pulse mt-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
