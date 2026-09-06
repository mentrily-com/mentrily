'use client';

import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

// This is a shared fallback: 13 other /dashboard/learner/* routes (browse,
// module, unit, bookmarks, analytics, ...) have no loading.tsx of their own
// and cascade to this one during the brief route-transition chunk load, so
// it has to stay a reasonable generic shape rather than matching any single
// page's exact layout. The main dashboard page itself (page.tsx) renders
// its own precisely-matched LearnerDashboardSkeleton for the actual,
// longer-duration data-fetch loading state -- that's the one that matters
// most for "does the skeleton match what's about to appear", since it's
// visible far longer than this route-transition flash ever is.
export default function LearnerLoading() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            <DashboardSkeleton type="main" userRole="student" noNavbar />
        </div>
    );
}
