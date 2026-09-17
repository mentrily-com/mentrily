'use client';
import React from 'react';

/**
 * Mirrors the bookmarks list in
 * app/(app)/dashboard/learner/bookmarks/page.tsx, which is a five-column
 * table on md+ and a stacked list below it. Both variants are reproduced so
 * the placeholder occupies the same space at every breakpoint and the real
 * rows do not shift the page when they arrive.
 */
export default function LearnerBookmarksSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="overflow-hidden bg-white border border-slate-100 rounded-xl shadow-sm">
            {/* desktop: table */}
            <table className="hidden w-full text-left border-collapse md:table">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                        {['Topic', 'Module', 'Course', 'Saved On', ''].map((h, i) => (
                            <th key={i} className="px-6 py-4">
                                <div
                                    className={`h-3 animate-pulse rounded bg-slate-200 ${
                                        i === 4 ? 'ml-auto w-12' : 'w-20'
                                    }`}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {Array.from({ length: rows }).map((_, i) => (
                        <tr key={i}>
                            <td className="px-6 py-5">
                                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                                <div className="mt-2 h-4 w-16 animate-pulse rounded-md bg-slate-100" />
                            </td>
                            <td className="px-6 py-5">
                                <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                            </td>
                            <td className="px-6 py-5">
                                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                            </td>
                            <td className="px-6 py-5">
                                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                            </td>
                            <td className="px-6 py-5">
                                <div className="ml-auto h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* mobile: stacked rows */}
            <div className="divide-y divide-slate-100 md:hidden">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2 px-5 py-4">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                    </div>
                ))}
            </div>
        </div>
    );
}
