/**
 * Purpose-built skeleton for `/dashboard/creator/settings`, which renders
 * `AdminSettingsView` once the organization's settings finish loading. The
 * previous fallback was the generic `DashboardSkeleton type="form"`, a
 * single centered card with a 2-column grid of label+input pairs -- quite
 * different from the real page, which has a header with a save button
 * followed by a wide two-thirds/one-third split: stacked "section" cards
 * on the left (branding, contact, permission toggles) and a narrower
 * summary/danger-zone card on the right. This mirrors that split and the
 * card rhythm rather than every field.
 */
export default function AdminSettingsSkeleton() {
    return (
        <div className="animate-fade-in pb-10 font-sans">
            <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="space-y-2">
                    <div className="h-6 w-64 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-14 w-44 animate-pulse rounded-2xl bg-slate-200" />
            </div>

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
                {/* Left: settings sections */}
                <div className="space-y-8 lg:col-span-2">
                    {[1, 2, 3].map((section) => (
                        <div key={section} className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                                    <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {[1, 2, 3, 4].map((field) => (
                                    <div key={field} className="space-y-2">
                                        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                                        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-50" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: summary card */}
                <div className="space-y-6">
                    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6">
                        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                                <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
                            </div>
                        ))}
                    </div>
                    <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                </div>
            </div>
        </div>
    );
}
