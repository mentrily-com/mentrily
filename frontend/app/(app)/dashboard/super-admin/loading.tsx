'use client';

import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

// Matches the skeleton the page itself renders while its data fetch
// resolves (`if (!authChecked || loading) return <DashboardSkeleton .../>`
// in page.tsx) so the route-transition fallback and the page's own loading
// state are the same visual — no white flash, no mismatched double-skeleton.
// Cascades to /dashboard/super-admin/* sub-routes without their own loading.tsx.
export default function SuperAdminLoading() {
    return <DashboardSkeleton type="main" />;
}
