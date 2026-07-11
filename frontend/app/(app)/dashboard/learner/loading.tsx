'use client';

import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

// Matches the skeleton the page itself renders while its data fetch
// resolves (`if (loading && !stats) return <DashboardSkeleton .../>` in
// page.tsx) so the route-transition fallback and the page's own loading
// state are the same visual — no white flash, no mismatched double-skeleton.
export default function LearnerLoading() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
            <DashboardSkeleton type="main" userRole="student" noNavbar />
        </div>
    );
}
