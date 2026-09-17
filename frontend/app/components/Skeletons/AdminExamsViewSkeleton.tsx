/**
 * Purpose-built skeleton for the admin "Examinations & Content" view
 * (`AdminExamsView.tsx`). It previously reused the generic
 * `DashboardSkeleton type="list"`, which renders a title+search header bar
 * that doesn't reflect this page's actual shape: a title block, an
 * underlined two-tab switcher (Examinations / Courses), a search-plus-
 * action-buttons row, and a wide table whose columns vary slightly by tab
 * (Examination/Course, Assigned In-charge, Count, Status, Schedule/Created,
 * Actions). This mirrors that section order and column proportions rather
 * than exact pixel content, so nothing pops in or shifts once real rows
 * replace the placeholders.
 */
export default function AdminExamsViewSkeleton() {
    return (
        <div className="pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
                <div className="space-y-2">
                    <div className="h-7 w-64 animate-pulse rounded-lg bg-slate-200" />
                    <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-slate-100" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-8 border-b border-slate-100 mb-10 pb-4">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>

            {/* Search & action bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                <div className="h-[60px] w-full flex-1 animate-pulse rounded-2xl bg-slate-100" />
                <div className="flex gap-2 w-full md:w-auto shrink-0">
                    <div className="h-[60px] w-28 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-[60px] w-40 animate-pulse rounded-2xl bg-slate-200" />
                </div>
            </div>

            {/* Content table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                <div className="flex items-center gap-8 px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
                    ))}
                    <div className="ml-auto h-2.5 w-14 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="divide-y divide-slate-50">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-8 px-8 py-6">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                                <div className="min-w-0 space-y-1.5">
                                    <div className="h-3.5 w-36 animate-pulse rounded bg-slate-200" />
                                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-40">
                                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-100" />
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
                                    <div className="h-2 w-24 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                            <div className="w-20 space-y-1.5">
                                <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200" />
                            </div>
                            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                            <div className="ml-auto flex items-center gap-2">
                                <div className="h-8 w-8 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-8 w-24 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-8 w-8 animate-pulse rounded-xl bg-slate-100" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
