/**
 * Purpose-built skeleton for the creator exam management page
 * (`/dashboard/creator/exams`). The previous fallback wrapped the generic
 * `DashboardSkeleton type="list"` in a rounded card, which renders one flat
 * list -- not this page's real shape of a title+button header, a row of
 * pill filter tabs, and two separate titled sections (Live Exams,
 * Course Linked Exams), each with its own table header and exam rows. That
 * mismatch meant the tabs and section titles popped in fully formed the
 * moment data arrived. Mirrors that header/tabs/two-section structure from
 * dashboard/creator/exams/page.tsx rather than exact row content.
 */
export default function CreatorExamsSkeleton() {
    return (
        <div className="pb-10 font-sans">
            <div className="mb-8 flex flex-col justify-between gap-4 md:mb-12 md:flex-row md:items-center">
                <div className="space-y-2">
                    <div className="h-6 w-56 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-200 sm:w-52" />
            </div>

            <div className="mb-8 grid grid-cols-2 gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm sm:mb-10 sm:flex sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-9 w-24 animate-pulse rounded-2xl bg-slate-100 sm:rounded-none" />
                ))}
            </div>

            <div className="space-y-7">
                {[1, 2].map((section) => (
                    <div key={section} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col justify-between gap-3 border-b border-black/5 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                            <div className="space-y-2">
                                <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                                <div className="h-2.5 w-64 max-w-full animate-pulse rounded bg-slate-100" />
                            </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                                    <div className="min-w-0 space-y-2">
                                        <div className="h-4 w-48 animate-pulse rounded-md bg-slate-200" />
                                        <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
                                    </div>
                                    <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
                                    <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center">
                                        {[1, 2, 3, 4].map((j) => (
                                            <div key={j} className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
