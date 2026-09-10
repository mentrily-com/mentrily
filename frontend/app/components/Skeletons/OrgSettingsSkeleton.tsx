/**
 * Purpose-built skeleton for the super-admin organization settings page
 * (`/dashboard/super-admin/organizations/[id]/settings`), which renders
 * `AdminSettingsView` once loaded. Previously this route used the generic
 * `DashboardSkeleton type="form"`, a single centered card with a 2-column
 * field grid that has nothing to do with the real layout: a title/save
 * header, then a two-thirds column of stacked icon+title settings cards
 * (super admin controls, identity, branding, contact, billing) beside a
 * one-third sticky dark "live preview" card -- so the page visibly
 * reflowed once the organization loaded. Mirrors that real section order
 * and column split rather than exact pixel content.
 */
export default function OrgSettingsSkeleton() {
    return (
        <div className="animate-fade-in font-sans pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
                <div className="space-y-2">
                    <div className="h-6 w-64 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-3.5 w-80 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-14 w-44 animate-pulse rounded-2xl bg-slate-200" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left: Settings Forms */}
                <div className="lg:col-span-2 space-y-8">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-sm">
                            <div className="flex items-start gap-4 mb-8">
                                <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                                    <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                                    <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                                    <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: Preview Card */}
                <div className="space-y-8">
                    <div className="rounded-xl p-8 h-fit sticky top-32 bg-slate-900/90">
                        <div className="h-2.5 w-32 animate-pulse rounded bg-white/10 mb-10" />
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-12 w-12 animate-pulse rounded-xl bg-white/10" />
                            <div className="space-y-2">
                                <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                                <div className="h-2.5 w-24 animate-pulse rounded bg-white/10" />
                            </div>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="h-2 w-3/4 animate-pulse rounded-full bg-white/10" />
                            <div className="h-2 w-1/2 animate-pulse rounded-full bg-white/10" />
                            <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
