/**
 * Purpose-built skeleton for the super-admin dashboard (`/dashboard/super-admin`).
 * Previously this route fell back to the generic `DashboardSkeleton type="main"`,
 * a card-list-plus-sidebar shape that doesn't match this page's actual
 * hero-with-side-panel -> health-banner -> orgs-list-plus-sidebar ->
 * bug-reports-table rhythm. Mirrors the real section order and proportions
 * from dashboard/super-admin/page.tsx rather than every pixel of content.
 */
export default function SuperAdminDashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* HERO: stats + plan distribution panel */}
            <div className="rounded-[30px] border border-slate-200 bg-white px-6 py-7 lg:px-8">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="h-6 w-32 animate-pulse rounded-full bg-slate-100" />
                            <div className="h-9 w-full max-w-2xl animate-pulse rounded-lg bg-slate-200 lg:h-11" />
                            <div className="h-4 w-full max-w-lg animate-pulse rounded-md bg-slate-100" />
                        </div>
                        <div className="h-11 w-56 animate-pulse rounded-xl bg-slate-200" />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                                        <div className="h-4 w-14 animate-pulse rounded-full bg-slate-100" />
                                    </div>
                                    <div className="mt-4 h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                                    <div className="mt-2 h-7 w-12 animate-pulse rounded-md bg-slate-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[24px] border border-slate-800 bg-slate-950 p-5">
                        <div className="h-3 w-28 animate-pulse rounded bg-white/20" />
                        <div className="mt-3 h-6 w-40 animate-pulse rounded-md bg-white/25" />
                        <div className="mt-5 space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between">
                                        <div className="h-3 w-12 animate-pulse rounded bg-white/15" />
                                        <div className="h-3 w-16 animate-pulse rounded bg-white/15" />
                                    </div>
                                    <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 h-16 w-full animate-pulse rounded-2xl bg-white/10" />
                    </div>
                </div>
            </div>

            {/* ORGS LIST + BILLING SIDEBAR */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                            <div className="h-6 w-72 animate-pulse rounded-md bg-slate-200" />
                            <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-10 w-44 animate-pulse rounded-xl bg-slate-200" />
                    </div>
                    <div className="mt-6 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-200" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                                            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                                            <div className="h-1.5 w-52 animate-pulse rounded-full bg-slate-100" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map((j) => (
                                            <div key={j} className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                    <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                    <div className="mt-5 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-200" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                                    <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* BUG REPORTS */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                        <div className="h-6 w-40 animate-pulse rounded-md bg-slate-200" />
                    </div>
                    <div className="h-9 w-32 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="mt-6 space-y-3">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-50" />
                    ))}
                </div>
            </div>
        </div>
    );
}
