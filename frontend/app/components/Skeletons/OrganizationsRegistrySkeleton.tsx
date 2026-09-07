/**
 * Purpose-built skeleton for the super-admin organizations registry
 * (`/dashboard/super-admin/organizations`). Previously this route used the
 * generic `DashboardSkeleton type="list"`, which renders a single accent
 * row above six plain rows with no header/filter bar and no per-row
 * "identity + domain + user count + plan + actions" columns, so the whole
 * page shape shifted (header, search/filter row, and the wider five-column
 * table) once real data arrived. This mirrors the real page order --
 * title + register button, search/filter row, then the table with its
 * five column groups -- rather than exact pixel content.
 */
export default function OrganizationsRegistrySkeleton() {
    return (
        <div className="max-w-[1440px] mx-auto animate-fade-in">
            <div className="px-6 lg:px-12 py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="space-y-3">
                        <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
                        <div className="h-4 w-80 animate-pulse rounded-md bg-slate-100" />
                    </div>
                    <div className="h-14 w-56 animate-pulse rounded-2xl bg-slate-200" />
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                    <div className="h-14 w-full flex-1 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100 md:w-48" />
                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100 md:w-64 shrink-0" />
                </div>

                {/* Organizations Table */}
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
                    <div className="flex items-center gap-8 bg-slate-50/50 border-b border-slate-100 px-8 py-5">
                        <div className="h-2.5 w-32 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-28 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200" />
                        <div className="ml-auto h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                    </div>
                    <div className="divide-y divide-slate-50">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center justify-between px-8 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                                        <div className="h-2.5 w-48 animate-pulse rounded bg-slate-100" />
                                    </div>
                                </div>
                                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-10 animate-pulse rounded bg-slate-100" />
                                <div className="h-5 w-20 animate-pulse rounded-lg bg-slate-100" />
                                <div className="flex items-center gap-2">
                                    <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100" />
                                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
