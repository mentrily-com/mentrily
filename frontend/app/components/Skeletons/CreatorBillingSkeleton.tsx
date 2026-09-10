/**
 * Purpose-built skeleton for `/dashboard/creator/billing`, shown while the
 * viewer's role is resolving (before it routes to `TeacherBillingPage` or
 * `AdminBillingPage`). The previous fallback was the generic
 * `DashboardSkeleton type="main"`, a card-list-plus-sidebar shape that
 * doesn't match either billing view -- both render a header with a
 * monthly/annual toggle, a current-plan summary card, a usage-quota grid,
 * and a row of plan-comparison cards below. This mirrors that vertical
 * stack of sections rather than either view's exact copy or numbers.
 */
export default function CreatorBillingSkeleton() {
    return (
        <div className="animate-fade-in space-y-6 pb-10 font-sans">
            {/* Header + interval toggle */}
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-2">
                    <div className="h-6 w-52 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-10 w-48 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
            </div>

            {/* Current plan summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
                <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                    <div className="space-y-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-16 animate-pulse rounded bg-slate-100" />
                            <div className="h-7 w-24 animate-pulse rounded-md bg-slate-200" />
                        </div>
                        <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-100" />
                        <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-200" />
                    </div>
                </div>
            </div>

            {/* Usage overview */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
                <div className="mb-6 h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between">
                                <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-10 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Plan comparison */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 md:p-8">
                <div className="mb-6 h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-4 rounded-xl border border-slate-200 p-5">
                            <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                            <div className="h-6 w-24 animate-pulse rounded-md bg-slate-200" />
                            <div className="space-y-2">
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="h-3 w-full animate-pulse rounded bg-slate-100" />
                                ))}
                            </div>
                            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
