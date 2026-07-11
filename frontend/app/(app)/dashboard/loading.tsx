'use client';
import BrandedPageLoader from '@/app/components/Common/BrandedPageLoader';

// Matches this route's own initial render (`!authChecked` renders the same
// BrandedPageLoader — see page.tsx) so the route-transition fallback and the
// page's first paint are pixel-identical: no visible swap, no white gap.
export default function DashboardRedirectLoading() {
    return <BrandedPageLoader />;
}
