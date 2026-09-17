/**
 * Purpose-built skeleton for the unified profile page
 * (`components/Features/Profile/UnifiedProfilePage.tsx`). The previous
 * `DashboardSkeleton type="form"` rendered a title bar plus a two-column
 * grid of labeled inputs, which doesn't match this page's real shape at
 * all: a centered avatar-and-name header card with role/id badges,
 * followed by the embedded Clerk `<UserProfile>` panel with its own side
 * navigation and detail pane. Mirrors that avatar-header-then-panel
 * layout and proportions rather than exact pixel content, since the
 * Clerk panel's internals aren't ours to predict.
 */
export default function ProfilePageSkeleton() {
    return (
        <div className="font-sans">
            {/* Avatar + name header */}
            <div className="bg-white rounded-xl border border-slate-100 p-6 md:p-8 mb-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="h-20 w-20 md:h-24 md:w-24 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
                <div className="min-w-0 flex-1 flex flex-col items-center md:items-start gap-3">
                    <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
                    <div className="h-3.5 w-56 animate-pulse rounded-md bg-slate-100" />
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
                        <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
                        <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
                    </div>
                </div>
            </div>

            {/* Embedded account-management panel (nav + detail pane) */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 bg-slate-50 p-4 space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-slate-100" />
                        ))}
                    </div>
                    <div className="flex-1 p-6 space-y-5">
                        <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                                <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
