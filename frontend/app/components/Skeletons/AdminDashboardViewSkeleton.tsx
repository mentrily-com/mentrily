/**
 * Purpose-built skeleton for the org admin dashboard (`AdminDashboardView.tsx`,
 * mounted under `/dashboard/creator`). It previously fell back to the generic
 * `DashboardSkeleton type="main"`, a two-column card-list-plus-sidebar shape
 * that doesn't match this page at all -- the real layout is a single title
 * header, a 3-column stats grid of six cards, a "Plan Usage" panel with
 * three progress bars, then a 2/3 + 1/3 split of an activity bar chart with
 * quick-action cards on the left and a dark "Live Status" panel on the
 * right. This mirrors that section order and proportions from
 * `AdminDashboardView.tsx` rather than every pixel of content.
 */
export default function AdminDashboardViewSkeleton() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
                <div className="flex items-center justify-between mb-12">
                    <div className="space-y-2">
                        <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
                        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-slate-100" />
                    </div>
                    <div className="hidden sm:block h-8 w-48 animate-pulse rounded-xl bg-slate-100" />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
                                <div className="h-5 w-14 animate-pulse rounded-lg bg-slate-100" />
                            </div>
                            <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100 mb-2" />
                            <div className="h-7 w-16 animate-pulse rounded-md bg-slate-200" />
                        </div>
                    ))}
                </div>

                {/* Plan usage panel */}
                <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm mb-8">
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-200 mb-5" />
                    <div className="space-y-5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                                    <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                                </div>
                                <div className="w-full h-2.5 animate-pulse rounded-full bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Analytics + live status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                                <div className="h-8 w-28 animate-pulse rounded-xl bg-slate-100" />
                            </div>
                            <div className="h-64 flex items-end justify-between gap-2 px-2">
                                {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 animate-pulse rounded-t-xl bg-slate-100"
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between mt-4 px-2">
                                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <div key={i} className="h-2.5 w-6 animate-pulse rounded bg-slate-100" />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2].map((i) => (
                                <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" />
                                        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-50" />
                                    </div>
                                    <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200 mb-2" />
                                    <div className="h-2.5 w-40 animate-pulse rounded bg-slate-100 mb-4" />
                                    <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[40px] p-8 space-y-8">
                        <div className="flex items-center justify-between mb-2">
                            <div className="h-5 w-24 animate-pulse rounded bg-white/25" />
                            <div className="h-5 w-20 animate-pulse rounded-full bg-white/15" />
                        </div>
                        <div className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="h-2.5 w-20 animate-pulse rounded bg-white/15" />
                                        <div className="h-2.5 w-16 animate-pulse rounded bg-white/15" />
                                    </div>
                                    <div className="h-3.5 w-40 animate-pulse rounded bg-white/20" />
                                    <div className="h-2.5 w-24 animate-pulse rounded bg-white/10" />
                                </div>
                            ))}
                        </div>
                        <div className="h-12 w-full animate-pulse rounded-xl bg-white/10" />
                    </div>
                </div>
            </main>
        </div>
    );
}
