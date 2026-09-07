/**
 * Purpose-built skeleton for the creator/admin studio dashboard
 * (`/dashboard/creator`) -- the first thing every teacher or admin sees
 * after logging in. Previously this route fell back to the generic
 * `DashboardSkeleton type="main"`, which renders a two-column
 * card-list-plus-sidebar shape; the real page is a hero banner, a 4-up
 * stat grid, a capacity strip, and *then* a two-column body -- a
 * completely different rhythm, so the whole page visibly reflowed once
 * data arrived instead of blocks simply resolving in place. Mirrors the
 * real section order and proportions from dashboard/creator/page.tsx
 * (hero -> stat cards -> capacity strip -> two-column body) rather than
 * attempting to replicate every pixel of the body's contents.
 */
export default function CreatorDashboardSkeleton() {
    return (
        <div className="space-y-5">
            {/* HERO */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:rounded-3xl lg:p-8">
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="h-6 w-32 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                    </div>
                    <div className="h-9 w-full max-w-xl animate-pulse rounded-lg bg-slate-200 sm:h-10" />
                    <div className="h-4 w-full max-w-md animate-pulse rounded-md bg-slate-100" />
                    <div className="flex flex-wrap gap-3">
                        <div className="h-11 w-36 animate-pulse rounded-xl bg-slate-200" />
                        <div className="h-11 w-32 animate-pulse rounded-xl bg-slate-100" />
                    </div>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-4 w-14 animate-pulse rounded-full bg-slate-100" />
                        </div>
                        <div className="mt-4 h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                        <div className="mt-2 h-7 w-10 animate-pulse rounded-md bg-slate-200" />
                    </div>
                ))}
            </div>

            {/* CAPACITY STRIP */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="grid gap-6 sm:grid-cols-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between">
                                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-10 animate-pulse rounded bg-slate-100" />
                            </div>
                            <div className="h-2 w-full animate-pulse rounded-full bg-slate-50" />
                        </div>
                    ))}
                </div>
            </div>

            {/* TWO-COLUMN BODY */}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 w-48 animate-pulse rounded-md bg-slate-200" />
                                    <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                                </div>
                                <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="mb-5 h-4 w-32 animate-pulse rounded-md bg-slate-200" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="h-3 w-full max-w-40 animate-pulse rounded bg-slate-100" />
                                    <div className="h-2.5 w-16 animate-pulse rounded bg-slate-50" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
