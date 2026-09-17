/**
 * Purpose-built skeleton for the course authoring shell
 * (`components/Features/Courses/CourseEditor.tsx`), shown while the
 * `CourseBuilder` authoring tool loads via `next/dynamic`. The previous
 * `DashboardSkeleton type="form" noNavbar` rendered a title bar and a
 * two-column field grid, nothing like the real tool: a sticky toolbar
 * (sidebar-toggle + title input + status pill + action buttons) above a
 * collapsible left sidebar (unit/test counts, a tab switcher, and a list
 * of section rows) next to a large empty-state editing canvas. Mirrors
 * that toolbar-plus-sidebar-plus-canvas rhythm and proportions rather
 * than exact pixel content.
 */
export default function CourseBuilderShellSkeleton() {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            {/* Toolbar */}
            <div className="border-b border-slate-200 px-4 py-2.5 md:px-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                        <div className="hidden lg:block h-5 w-28 shrink-0 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-6 w-64 max-w-full animate-pulse rounded-lg bg-slate-100" />
                        <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-slate-100" />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 md:gap-2">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-200" />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="hidden lg:flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/60">
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-2.5 w-12 animate-pulse rounded bg-slate-100" />
                            ))}
                        </div>
                    </div>
                    <div className="border-b border-slate-200 bg-white px-4 py-2.5">
                        <div className="h-8 w-full animate-pulse rounded-xl bg-slate-100" />
                    </div>
                    <div className="flex-1 p-4 space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-14 w-full animate-pulse rounded-2xl bg-white border border-slate-100" />
                        ))}
                    </div>
                </div>

                {/* Editing canvas */}
                <div className="flex-1 overflow-hidden p-6 md:p-8 space-y-6 bg-[linear-gradient(180deg,_rgba(248,250,252,0.94),_rgba(255,255,255,1))]">
                    <div className="mx-auto max-w-4xl space-y-6">
                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 md:p-8 space-y-4">
                            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                            <div className="h-7 w-2/3 animate-pulse rounded-lg bg-slate-200" />
                            <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="rounded-[32px] border border-slate-200 bg-white p-6 md:p-8 space-y-3">
                            <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                            <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-100" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
