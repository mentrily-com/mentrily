/**
 * Purpose-built skeleton for the teacher billing page
 * (`dashboard/creator/_components/TeacherBillingPage.tsx`). The previous
 * skeleton here was the generic `DashboardSkeleton type="main"`, whose
 * card-list-plus-sidebar shape has nothing to do with this page's actual
 * header -> current-plan section -> usage-meter grid -> plan-comparison
 * card grid rhythm, so the whole layout reflowed once billing data landed.
 * Mirrors that real section order and proportions (title + interval
 * toggle, a single current-plan card with two action buttons, a 2-column
 * quota grid, then a 4-column row of plan cards) rather than exact pixel
 * content.
 */
export default function TeacherBillingSkeleton() {
    return (
        <div className="font-sans pb-10">
            {/* Header + interval toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <div className="space-y-2">
                    <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200" />
                    <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-slate-100" />
                </div>
                <div className="h-11 w-40 animate-pulse rounded-lg bg-slate-100" />
            </div>

            {/* Current plan */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 md:p-8 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-16 animate-pulse rounded bg-slate-100" />
                            <div className="h-7 w-20 animate-pulse rounded-md bg-slate-200" />
                        </div>
                        <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-44 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                        <div className="h-10 w-full sm:w-32 animate-pulse rounded-lg bg-slate-100" />
                        <div className="h-10 w-full sm:w-36 animate-pulse rounded-lg bg-slate-200" />
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                </div>
            </section>

            {/* Usage overview */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 md:p-8 mb-6">
                <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between">
                                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
                        </div>
                    ))}
                </div>
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="h-2.5 w-28 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-200" />
                </div>
            </section>

            {/* Plan comparison */}
            <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 md:p-8 mb-6">
                <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="rounded-xl border border-slate-100 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="h-3 w-14 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="h-7 w-20 animate-pulse rounded-md bg-slate-200" />
                            <div className="space-y-2.5">
                                {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                                    <div key={j} className="flex justify-between border-b border-slate-100 pb-1.5">
                                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                                        <div className="h-2.5 w-10 animate-pulse rounded bg-slate-100" />
                                    </div>
                                ))}
                            </div>
                            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
