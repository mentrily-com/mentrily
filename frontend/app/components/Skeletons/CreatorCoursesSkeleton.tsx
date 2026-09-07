/**
 * Purpose-built skeleton for the creator courses/studio page
 * (`/dashboard/creator/courses`). The previous fallback, the generic
 * `DashboardSkeleton type="list"`, is a single flat card of table rows,
 * while the real page is a two-column layout: a left "My Modules" column
 * with a search box, a two-tab switcher, and module row-cards (title,
 * status pill, enrollment line, action buttons), plus a right "Learner
 * signals" activity sidebar. Mirrors that two-column split and each side's
 * row shapes from StudioModuleList/StudioRecentActivity, used by
 * dashboard/creator/courses/page.tsx, rather than exact copy.
 */
export default function CreatorCoursesSkeleton() {
    return (
        <div className="font-sans">
            <div className="mb-6 space-y-2">
                <div className="h-6 w-32 animate-pulse rounded-md bg-slate-200" />
                <div className="h-3 w-96 max-w-full animate-pulse rounded bg-slate-100" />
            </div>

            <div className="flex flex-col gap-8 xl:flex-row">
                {/* LEFT: module list */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="h-5 w-28 animate-pulse rounded-md bg-slate-200" />
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100 sm:w-56" />
                            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-200 sm:w-44" />
                        </div>
                    </div>

                    <div className="flex w-full gap-1 mb-5 p-1 rounded-lg bg-slate-100 sm:w-fit">
                        <div className="h-7 w-24 animate-pulse rounded-md bg-white" />
                        <div className="h-7 w-24 animate-pulse rounded-md bg-slate-100" />
                    </div>

                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-4 w-48 animate-pulse rounded-md bg-slate-200" />
                                            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
                                        </div>
                                        <div className="h-2.5 w-56 animate-pulse rounded bg-slate-100" />
                                    </div>
                                    <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:shrink-0">
                                        {[1, 2, 3].map((j) => (
                                            <div key={j} className="h-8 w-full animate-pulse rounded-lg bg-slate-100 sm:w-20" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: recent activity */}
                <aside className="w-full xl:w-80 shrink-0">
                    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="space-y-2">
                                <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                                <div className="h-5 w-32 animate-pulse rounded-md bg-slate-200" />
                            </div>
                            <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                        </div>
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3">
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-200" />
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                                            <div className="h-2.5 w-full animate-pulse rounded bg-slate-100" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
