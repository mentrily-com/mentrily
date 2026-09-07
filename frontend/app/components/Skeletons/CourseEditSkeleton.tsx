/**
 * Purpose-built skeleton for `/dashboard/creator/courses/[id]/edit`, both
 * while the course record is loading and while the `CourseBuilder` studio
 * is being dynamically imported afterward. The previous fallback was the
 * generic `DashboardSkeleton type="form"`, a centered card of label+input
 * pairs -- nothing like the real studio, which fills the viewport with a
 * sticky toolbar over a fixed left sidebar (stats strip, tab toggle,
 * section list) next to a scrolling main canvas of stacked cards. This
 * mirrors that toolbar/sidebar/canvas rhythm and proportions rather than
 * the exact controls, so the loading state resolves into the same shape
 * the builder actually renders.
 */
export default function CourseEditSkeleton() {
    return (
        <div className="teacher-theme h-[calc(100vh-var(--topbar-height)-36px)]">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 md:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                        <div className="hidden h-5 w-28 shrink-0 animate-pulse rounded-full bg-slate-100 lg:block" />
                        <div className="h-5 w-full max-w-xs animate-pulse rounded-md bg-slate-100" />
                        <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-slate-100" />
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                        <div className="mx-1 h-5 w-px bg-slate-100" />
                        <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-200" />
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: stats strip + tab toggle + section list */}
                    <div className="hidden w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60 lg:flex">
                        <div className="border-b border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-3 w-9 animate-pulse rounded bg-slate-100" />
                                ))}
                            </div>
                        </div>
                        <div className="border-b border-slate-200 bg-white px-4 py-2.5">
                            <div className="h-8 w-full animate-pulse rounded-xl bg-slate-100" />
                        </div>
                        <div className="flex-1 space-y-4 p-4">
                            <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-white"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Main canvas: stacked form cards */}
                    <div className="flex-1 overflow-hidden p-5 md:p-6">
                        <div className="mx-auto max-w-5xl space-y-5">
                            <div className="h-24 animate-pulse rounded-[28px] bg-slate-100" />
                            <div className="h-72 animate-pulse rounded-[24px] bg-slate-100" />
                            <div className="h-40 animate-pulse rounded-[24px] bg-slate-100" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
