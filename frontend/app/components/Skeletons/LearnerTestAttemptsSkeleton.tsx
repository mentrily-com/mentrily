/**
 * Purpose-built skeleton for the learner test-attempts page
 * (`/dashboard/learner/test`). Previously this used the generic
 * `DashboardSkeleton type="list"`, whose rows include an icon avatar and a
 * full-width header row that don't exist here -- the real page is a single
 * bordered tab strip followed by a bare data table (Tests / Scores / Time
 * taken / Submitted / Actions columns) and a centered pagination control.
 * Mirrors that tab-strip + table + pagination structure from
 * dashboard/learner/test/page.tsx rather than exact cell content.
 */
export default function LearnerTestAttemptsSkeleton() {
    return (
        <div className="min-h-screen bg-white font-sans">
            {/* TAB STRIP */}
            <div className="border-b border-slate-100">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="h-4 w-28 my-4 animate-pulse rounded-md bg-slate-200" />
                </div>
            </div>

            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
                <div className="overflow-hidden bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="hidden md:flex items-center px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200 w-1/2" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200 ml-8" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200 ml-8" />
                        <div className="h-2.5 w-14 animate-pulse rounded bg-slate-200 ml-8" />
                    </div>
                    <div className="divide-y divide-slate-50">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
                                <div className="h-4 w-1/2 max-w-xs animate-pulse rounded-md bg-slate-200" />
                                <div className="h-3 w-12 animate-pulse rounded bg-slate-100 sm:ml-8" />
                                <div className="h-3 w-16 animate-pulse rounded bg-slate-100 sm:ml-8" />
                                <div className="h-3 w-20 animate-pulse rounded bg-slate-100 sm:ml-8" />
                                <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-100 sm:ml-8" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* PAGINATION */}
                <div className="mt-8 flex items-center justify-center gap-4">
                    <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
                </div>
            </main>
        </div>
    );
}
