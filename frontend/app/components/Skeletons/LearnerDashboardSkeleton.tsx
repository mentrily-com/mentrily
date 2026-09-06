/**
 * Purpose-built skeleton for the learner dashboard (`/dashboard/learner`) --
 * the first thing every student sees after logging in. The previous
 * skeleton here was the generic `DashboardSkeleton type="main"`, which
 * renders a full-width title+button header bar that doesn't exist anywhere
 * on this page (the real "Course Modules" heading + search box lives
 * *inside* the left column, not above the two-column layout), so it
 * visibly popped out of existence the moment real data arrived, shifting
 * everything below it up by ~80px. This mirrors the real DOM shape line
 * for line -- see the two-column layout, module row, streak card, and
 * announcements card in dashboard/learner/page.tsx -- so nothing appears
 * or disappears when the real content swaps in, only the placeholder
 * blocks resolve into text and numbers in place.
 */
export default function LearnerDashboardSkeleton() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
                <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
                    {/* LEFT: module list */}
                    <div className="flex-1">
                        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
                            <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200" />
                            <div className="h-11 w-full animate-pulse rounded-2xl bg-slate-100 sm:w-72" />
                        </div>

                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6"
                                >
                                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                        <div className="min-w-0 flex-1 space-y-2.5">
                                            <div className="h-5 w-3/5 max-w-64 animate-pulse rounded-md bg-slate-200" />
                                            <div className="h-3 w-40 animate-pulse rounded-md bg-slate-100" />
                                        </div>
                                        <div className="flex w-full items-center gap-4 sm:w-1/2 sm:gap-8">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between">
                                                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-100" />
                                                    <div className="h-2.5 w-8 animate-pulse rounded bg-slate-100" />
                                                </div>
                                                <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-50" />
                                            </div>
                                            <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-slate-100" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: streak + announcements */}
                    <aside className="w-full space-y-6 lg:w-80">
                        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-200 to-slate-300 p-6 text-center sm:p-8">
                            <div className="mx-auto mb-4 h-3 w-24 animate-pulse rounded bg-white/40" />
                            <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl bg-white/40" />
                            <div className="mx-auto h-3 w-40 animate-pulse rounded bg-white/30" />
                        </div>

                        <div className="rounded-[32px] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
                            <div className="mb-6 flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-5 w-32 animate-pulse rounded-md bg-slate-200" />
                            </div>
                            <div className="space-y-3">
                                {[1, 2].map((i) => (
                                    <div key={i} className="rounded-2xl border border-slate-100 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                                                <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
