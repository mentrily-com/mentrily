/**
 * Purpose-built skeleton for the teacher students/roster page
 * (`dashboard/creator/_components/TeacherStudentsPage.tsx`). It previously
 * used the generic `DashboardSkeleton type="list"`, a full-width simple
 * row list that ignores this page's actual tab switcher, the small
 * "Total Students" stat pill above the table, and the table's own
 * header bar with a search box and per-row avatar/progress-bar/actions
 * layout -- so the page's shape changed noticeably once the roster loaded.
 * Mirrors that real section order (title, tabs, stat pill + export button,
 * table with a search-bar header and five-column rows) and proportions
 * rather than exact pixel content.
 */
export default function TeacherStudentsSkeleton() {
    return (
        <div className="font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="space-y-2">
                    <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />
                    <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-slate-100" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-8 p-1 w-fit rounded-lg bg-slate-100">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 w-32 animate-pulse rounded-md bg-slate-200/70" />
                ))}
            </div>

            {/* Stat pill + export button */}
            <div className="flex items-center justify-between mb-6">
                <div className="bg-white border border-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
                    <div className="h-5 w-5 animate-pulse rounded bg-slate-100" />
                    <div className="space-y-1.5">
                        <div className="h-2 w-20 animate-pulse rounded bg-slate-100" />
                        <div className="h-4 w-10 animate-pulse rounded bg-slate-200" />
                    </div>
                </div>
                <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
            </div>

            {/* Roster table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50">
                    <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200" />
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="h-9 w-full md:w-72 animate-pulse rounded-lg bg-slate-100" />
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    <div className="hidden md:flex px-6 py-4 gap-6">
                        {['Student Profile', 'Primary Course', 'Progress', 'Activity', 'Actions'].map((label) => (
                            <div key={label} className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                        ))}
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-4">
                            <div className="flex items-center gap-3 md:w-56 shrink-0">
                                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
                            <div className="flex items-center gap-3 flex-1 max-w-[160px]">
                                <div className="flex-1 h-2 animate-pulse rounded-full bg-slate-100" />
                                <div className="h-3 w-8 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="h-2 w-16 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="md:ml-auto h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
