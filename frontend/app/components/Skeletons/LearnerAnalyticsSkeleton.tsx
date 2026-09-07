/**
 * Purpose-built skeleton for the learner (and teacher-viewing-a-learner)
 * analytics page (`/dashboard/learner/analytics`). Previously this used the
 * generic `DashboardSkeleton type="main"`, whose single-column-with-sidebar
 * shape bears no resemblance to the real dashboard-of-widgets layout here --
 * a sticky title+tabs sub-header, a row of six stat tiles, a wide
 * consistency-heatmap card, a two-column activity-chart/outcome-donut row,
 * and a two-column course-progress/question-type row. Mirrors that section
 * order and proportion from dashboard/learner/analytics/page.tsx rather than
 * exact chart content, so the real widgets resolve into place instead of
 * replacing an unrelated shape.
 */
export default function LearnerAnalyticsSkeleton() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans">
            {/* STICKY SUB-HEADER */}
            <div className="sticky top-[56px] sm:top-[61px] z-40 bg-white border-b border-slate-200/60 shadow-sm">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="h-5 w-56 animate-pulse rounded-md bg-slate-200" />
                        <div className="h-2.5 w-72 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                    </div>
                </div>
            </div>

            <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
                {/* STAT TILES */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-2.5 w-12 animate-pulse rounded bg-slate-100" />
                                <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
                            </div>
                            <div className="h-6 w-12 animate-pulse rounded-md bg-slate-200" />
                            <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                        </div>
                    ))}
                </div>

                {/* CONSISTENCY HEATMAP */}
                <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
                        <div className="space-y-2">
                            <div className="h-4 w-44 animate-pulse rounded-md bg-slate-200" />
                            <div className="h-2.5 w-56 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="h-28 w-full animate-pulse rounded-xl bg-slate-50" />
                </div>

                {/* DAILY ACTIVITY + OUTCOME DONUT */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                        <div className="mb-6 space-y-2">
                            <div className="h-4 w-36 animate-pulse rounded-md bg-slate-200" />
                            <div className="h-2.5 w-52 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-[280px] w-full animate-pulse rounded-xl bg-slate-50" />
                    </div>
                    <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                        <div className="mb-4 space-y-2">
                            <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200" />
                            <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-[200px] w-full animate-pulse rounded-full bg-slate-50" />
                        <div className="mt-5 space-y-2.5">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-3 w-full animate-pulse rounded bg-slate-100" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* COURSE PROGRESS + QUESTION TYPES */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2].map((col) => (
                        <div key={col} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                            <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200 mb-1" />
                            <div className="h-2.5 w-56 animate-pulse rounded bg-slate-100 mb-6" />
                            <div className="space-y-5">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                                            <div className="h-2.5 w-10 animate-pulse rounded bg-slate-100" />
                                        </div>
                                        <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
