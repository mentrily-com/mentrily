/**
 * Purpose-built skeleton for the super-admin exam edit page
 * (`/dashboard/super-admin/organizations/[id]/exams/[examId]/edit`), which
 * renders `ExamEditor` -> `ExamBuilder` once the exam loads. Previously
 * this route used the generic `DashboardSkeleton type="form"`, a plain
 * white card with a 2x2 field grid that has none of the editor's real
 * shape: a sticky header (back arrow, title input, status pill, save
 * button), a stats strip, a tab bar, and a two-column body (a section
 * list sidebar beside a details card with labeled fields), so the page
 * visibly reflowed once the exam data and builder mounted. Mirrors that
 * real chrome and column split rather than exact pixel content.
 */
export default function ExamEditFormSkeleton() {
    return (
        <div className="h-[calc(100vh-var(--topbar-height)-36px)]">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
                {/* Sticky header */}
                <div className="border-b border-slate-200 px-4 py-2.5 md:px-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
                            <div className="h-5 w-64 max-w-full animate-pulse rounded-md bg-slate-200" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-200" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* Left: section list sidebar */}
                    <div className="hidden lg:flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                                <div className="h-3 w-px bg-slate-200" />
                                <div className="h-2.5 w-12 animate-pulse rounded bg-slate-200" />
                                <div className="h-3 w-px bg-slate-200" />
                                <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200" />
                            </div>
                        </div>
                        <div className="border-b border-slate-200 px-4 py-2.5">
                            <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
                                <div className="h-7 w-1/2 animate-pulse rounded-lg bg-white" />
                                <div className="h-7 w-1/2 animate-pulse rounded-lg bg-slate-100" />
                            </div>
                        </div>
                        <div className="flex-1 p-4 space-y-4">
                            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
                                    <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: details form */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-slate-50/20">
                        <div className="mx-auto max-w-5xl space-y-5">
                            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm space-y-3">
                                <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
                                <div className="h-8 w-2/3 animate-pulse rounded-md bg-slate-200" />
                                <div className="h-3.5 w-full max-w-md animate-pulse rounded bg-slate-100" />
                            </div>

                            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                                    <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                                            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-28 animate-pulse rounded bg-slate-100" />
                                    <div className="h-24 w-full animate-pulse rounded-xl bg-slate-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
