/**
 * Purpose-built skeleton for the admin "User Management" view
 * (`AdminUsersView.tsx`). It previously fell back to the generic
 * `DashboardSkeleton type="list"`, whose header/table proportions don't
 * match this view: the real page has a title+button header, a search bar
 * with a filter-pill row beside it, then a table with an Identity / Role &
 * Dept / Account Status / Actions column layout (see `UsersTable.tsx`).
 * This mirrors that section order and column shape rather than exact
 * pixel content, so the skeleton resolves into the real rows in place
 * instead of the page reflowing when data arrives.
 */
export default function AdminUsersViewSkeleton() {
    return (
        <div className="font-sans text-slate-900">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                    <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />
                    <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-slate-100" />
                </div>
                <div className="h-10 w-44 animate-pulse rounded-lg bg-slate-200" />
            </div>

            {/* Search & filter bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-6 p-2 rounded-xl border border-slate-100 bg-white/50">
                <div className="h-10 w-full flex-1 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex gap-2 w-full md:w-auto shrink-0">
                    <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-100" />
                    <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-100" />
                </div>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                <div className="flex items-center gap-6 px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="divide-y divide-slate-100">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-6 px-6 py-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                                    <div className="h-2.5 w-44 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="w-24 space-y-1.5">
                                <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
                                <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="w-28 flex items-center gap-2">
                                <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-slate-200" />
                                <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="ml-auto flex items-center gap-1.5">
                                <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                                <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
