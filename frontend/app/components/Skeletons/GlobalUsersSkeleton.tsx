/**
 * Purpose-built skeleton for the super-admin global user index
 * (`/dashboard/super-admin/users`). Previously this route used the generic
 * `DashboardSkeleton type="list"`, which has no header/total-users badge,
 * no search bar, and a two-action row shape that doesn't match this page's
 * four-column table (identity, role, org, status) with a three-icon action
 * cluster and a pagination footer, so the layout visibly reflowed once real
 * users loaded. Mirrors that real section order and column proportions
 * from users/page.tsx rather than exact pixel content.
 */
export default function GlobalUsersSkeleton() {
    return (
        <div className="max-w-[1440px] mx-auto animate-fade-in">
            <div className="px-6 lg:px-12 py-10">
                <div className="flex items-center justify-between mb-12">
                    <div className="space-y-3">
                        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
                        <div className="h-4 w-80 animate-pulse rounded-md bg-slate-100" />
                    </div>
                    <div className="h-16 w-44 animate-pulse rounded-2xl bg-slate-100" />
                </div>

                {/* Search */}
                <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                </div>

                {/* Table */}
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
                    <div className="flex items-center gap-10 bg-slate-50/50 border-b border-slate-100 px-8 py-5">
                        <div className="h-2.5 w-32 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-32 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                        <div className="ml-auto h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                    </div>
                    <div className="divide-y divide-slate-50">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="flex items-center justify-between px-8 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                                        <div className="h-2.5 w-44 animate-pulse rounded bg-slate-100" />
                                    </div>
                                </div>
                                <div className="h-5 w-24 animate-pulse rounded-lg bg-slate-100" />
                                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-200" />
                                    <div className="h-2.5 w-14 animate-pulse rounded bg-slate-100" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="flex gap-2">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                    </div>
                </div>
            </div>
        </div>
    );
}
