/**
 * Purpose-built skeleton for the super-admin single-organization dashboard
 * (`/dashboard/super-admin/organizations/[id]/dashboard`). Previously this
 * route used the generic `DashboardSkeleton type="main"`, a card-list-plus-
 * sidebar shape with nothing in common with the real "Organization Controls"
 * panel -- a header with a name + 4 usage stat tiles, followed by two side
 * by side cards (plan select + save button, and a grid of labeled numeric
 * limit fields + save button) -- so it visibly popped once real data
 * arrived. The embedded `AdminDashboardView` below this panel manages its
 * own loading state separately and isn't mirrored here. Matches the real
 * section order and proportions from this page's JSX rather than exact
 * pixel content.
 */
export default function OrgControlsSkeleton() {
    return (
        <div className="space-y-6">
            <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-8">
                <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="space-y-2">
                            <div className="h-6 w-56 animate-pulse rounded-md bg-slate-200" />
                            <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 space-y-1.5">
                                    <div className="h-2 w-10 animate-pulse rounded bg-slate-200 mx-auto" />
                                    <div className="h-4 w-8 animate-pulse rounded bg-slate-200 mx-auto" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-100 p-4 space-y-3">
                            <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
                            <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-200" />
                        </div>

                        <div className="rounded-2xl border border-slate-100 p-4 space-y-3">
                            <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                            <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                                        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                                    </div>
                                ))}
                            </div>
                            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/20" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
