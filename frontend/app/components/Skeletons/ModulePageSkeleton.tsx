/**
 * Purpose-built skeleton for the learner module page (`/dashboard/learner/module/[slug]`),
 * shown while the course, progress, and exam-status requests are in flight.
 * The previous skeleton here was the generic `DashboardSkeleton type="list"`,
 * a single white card of table-style rows that has nothing to do with this
 * page's real shape: a sticky title+tabs sub-header, a horizontally
 * scrolling row of module cards, and a vertical list of unit rows below it.
 * That mismatch meant the whole skeleton vanished and the real sticky header
 * and card carousel popped in at once. This mirrors the sticky header, the
 * module-card carousel, and the "Unit Curriculum" row list from
 * dashboard/learner/module/[slug]/page.tsx in proportion, not exact content.
 */
export default function ModulePageSkeleton() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            {/* STICKY SUB-HEADER */}
            <div className="sticky top-[56px] sm:top-[61px] z-40 bg-white border-b border-slate-200/60 shadow-sm">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200" />
                            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                            <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
                        <div className="hidden sm:flex items-center gap-4">
                            <div className="w-32 h-2 animate-pulse rounded-full bg-slate-100" />
                            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
                <div className="space-y-10">
                    {/* MODULE CARD CAROUSEL */}
                    <div className="flex gap-4 overflow-hidden pb-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="min-w-[220px] max-w-[220px] h-[160px] shrink-0 rounded-[24px] border-2 border-slate-100 bg-white p-5 flex flex-col justify-between sm:min-w-[240px] sm:max-w-[240px] sm:h-[170px] sm:p-6"
                            >
                                <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                                <div className="h-4 w-4/5 animate-pulse rounded-md bg-slate-200" />
                                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-100" />
                                    <div className="h-1.5 w-12 animate-pulse rounded-full bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* UNIT CURRICULUM LIST */}
                    <div className="space-y-3">
                        <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200 ml-2 mb-4" />
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="px-4 py-4 rounded-[22px] border border-slate-100/80 bg-white flex items-center justify-between sm:px-8 sm:py-5 sm:rounded-[24px]"
                            >
                                <div className="flex min-w-0 items-center gap-4 flex-1 sm:gap-10">
                                    <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-slate-100" />
                                    <div className="min-w-0 space-y-2">
                                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                                        <div className="h-4 w-56 max-w-full animate-pulse rounded-md bg-slate-200" />
                                    </div>
                                </div>
                                <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
