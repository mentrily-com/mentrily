'use client';

import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

// Matches this route's own initial render (`!authChecked` renders the same
// DashboardSkeleton -- see page.tsx) so the route-transition fallback and the
// page's first paint are identical: no visible swap, no white gap. This is
// the landing point straight after login and signup, so any mismatch here is
// the first thing a new user sees.
export default function DashboardRedirectLoading() {
    return <DashboardSkeleton type="main" noNavbar />;
}
