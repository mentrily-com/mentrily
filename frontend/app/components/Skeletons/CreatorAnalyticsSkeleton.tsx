/**
 * Purpose-built skeleton for the creator/admin analytics page
 * (`/dashboard/creator/analytics`). The previous fallback, the generic
 * `DashboardSkeleton type="main"`, renders a card-list-plus-sidebar shape
 * that has nothing in common with this page's real report layout: a
 * title+date-range-picker header followed by a stack of white report
 * sections (metric tiles + trend chart, per-exam histogram + donut,
 * question difficulty bars, a course table, a day/hour heatmap grid, and an
 * area chart). Mirrors that section stack and each section's internal
 * proportions from dashboard/creator/analytics/page.tsx rather than
 * reproducing exact chart data.
 */
export default function CreatorAnalyticsSkeleton() {
    return (
        <div className="font-sans pb-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
                <div className="space-y-2">
                    <div className="h-6 w-32 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
            </div>

            {/* OVERVIEW: metric tiles + trend chart + side panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                            <div className="h-7 w-16 animate-pulse rounded-md bg-slate-200" />
                        </div>
                    ))}
                </div>
                <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 rounded-2xl border border-slate-100 p-5 bg-slate-50/40">
                        <div className="h-4 w-36 animate-pulse rounded-md bg-slate-200 mb-4" />
                        <div className="h-[300px] w-full animate-pulse rounded-xl bg-slate-100" />
                    </div>
                    <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                                <div className="h-5 w-20 animate-pulse rounded-md bg-slate-200" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* PER-EXAM: histogram + donut + difficulty bars */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-9 w-48 animate-pulse rounded-xl bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 rounded-2xl border border-slate-100 p-5">
                        <div className="h-2.5 w-40 animate-pulse rounded bg-slate-100 mb-3" />
                        <div className="h-[280px] w-full animate-pulse rounded-xl bg-slate-50" />
                    </div>
                    <div className="rounded-2xl border border-slate-100 p-5">
                        <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100 mb-3" />
                        <div className="h-[220px] w-full animate-pulse rounded-full bg-slate-50" />
                    </div>
                </div>
                <div className="mt-6 rounded-2xl border border-slate-100 p-5">
                    <div className="h-2.5 w-48 animate-pulse rounded bg-slate-100 mb-3" />
                    <div className="h-[260px] w-full animate-pulse rounded-xl bg-slate-50" />
                </div>
            </div>

            {/* PER-COURSE TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 mt-6">
                <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200 mb-5" />
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 w-full animate-pulse rounded-md bg-slate-50" />
                    ))}
                </div>
            </div>

            {/* HEATMAP */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 mt-6">
                <div className="h-4 w-56 animate-pulse rounded-md bg-slate-200 mb-5" />
                <div className="h-40 w-full animate-pulse rounded-lg bg-slate-50" />
            </div>

            {/* AREA CHART */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 mt-6">
                <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200 mb-4" />
                <div className="h-[260px] w-full animate-pulse rounded-xl bg-slate-50" />
            </div>
        </div>
    );
}
