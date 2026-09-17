/**
 * Purpose-built skeleton for `ExamMonitorView`, the live student-activity
 * monitor teachers/admins see while proctoring an exam. The previous
 * fallback was the generic `DashboardSkeleton type="list"`, a single card
 * of alternating rows -- it had no header/tab-buttons area and only one
 * row shape, while the real view opens with a title + view-switcher
 * buttons, then a 5-up KPI card grid, then a wide table with a
 * student-info column plus several status columns. This mirrors that
 * header/KPI-grid/table rhythm rather than real student data.
 */
export default function ExamMonitorSkeleton() {
    return (
        <div className="animate-fade-in pb-10">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="h-7 w-64 animate-pulse rounded-md bg-slate-200" />
                        <div className="h-5 w-12 animate-pulse rounded-lg bg-slate-100" />
                    </div>
                    <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-40 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-12 w-44 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-12 w-32 animate-pulse rounded-2xl bg-slate-100" />
                </div>
            </div>

            {/* KPI Grid */}
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5">
                        <div className="mb-2 h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                        <div className="h-6 w-10 animate-pulse rounded-md bg-slate-200" />
                    </div>
                ))}
            </div>

            {/* Monitor Table */}
            <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white">
                <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200" />
                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200" />
                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200" />
                    <div className="ml-auto h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="divide-y divide-slate-50">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-5">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                            <div className="min-w-[220px] flex-1 space-y-2">
                                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                                <div className="h-2.5 w-44 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
                            <div className="h-6 w-10 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-6 w-10 animate-pulse rounded-xl bg-slate-100" />
                            <div className="ml-auto h-6 w-16 animate-pulse rounded-lg bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
