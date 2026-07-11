// Public course landing page fetches server-side with no caching, so this
// Suspense fallback covers a real network wait every visit. Overrides the
// parent [orgSlug]/loading.tsx (a playground-shaped skeleton, wrong shape
// for this marketing/course-preview page).
export default function PublicCourseLoading() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
            <main className="max-w-4xl mx-auto px-6 py-10">
                <section className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
                    <div className="h-56 w-full animate-pulse bg-slate-100" />
                    <div className="p-8">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-7 w-2/3 animate-pulse rounded-lg bg-slate-200" />
                        <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
                        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />

                        <div className="mt-8 space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4"
                                >
                                    <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
                                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
