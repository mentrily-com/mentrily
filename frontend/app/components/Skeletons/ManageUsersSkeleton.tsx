/**
 * Purpose-built skeleton for the creator "Manage Users" page
 * (`/dashboard/creator/manage-users`), shown while the caller's role is
 * still resolving, before `AdminUsersView` itself takes over loading. The
 * previous generic `DashboardSkeleton type="list"` rendered a plain card of
 * table rows with an icon avatar per row that doesn't match this page's
 * real shape: a title+button header, a glassy search-and-filter bar, and a
 * dense identity/role/status/actions table. Mirrors that header, filter
 * bar, and table-row shape from AdminUsersView/UsersTable rather than exact
 * user data.
 */
export default function ManageUsersSkeleton() {
    return (
        <div className="font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                    <div className="h-6 w-48 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-3 w-72 max-w-full animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200" />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 mb-6 p-2 rounded-xl border border-slate-100 bg-white/50">
                <div className="h-9 w-full flex-1 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex gap-2 w-full md:w-auto shrink-0">
                    <div className="h-9 w-full md:w-28 animate-pulse rounded-lg bg-slate-100" />
                    <div className="h-9 w-full md:w-28 animate-pulse rounded-lg bg-slate-100" />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="hidden md:flex items-center px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200" style={{ width: '30%' }} />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" style={{ width: '25%' }} />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" style={{ width: '25%' }} />
                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200 ml-auto" />
                </div>
                <div className="divide-y divide-slate-100">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4">
                            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200" />
                                <div className="h-2.5 w-56 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="hidden sm:block h-5 w-20 animate-pulse rounded-lg bg-slate-100" />
                            <div className="hidden sm:flex items-center gap-2">
                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-200" />
                                <div className="h-2.5 w-14 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="flex items-center gap-1.5">
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
