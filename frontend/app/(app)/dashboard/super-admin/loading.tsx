import SuperAdminDashboardSkeleton from '@/app/components/Skeletons/SuperAdminDashboardSkeleton';

// Matches what page.tsx renders while its data resolves, so the
// route-transition fallback and the page's own loading state are the same
// visual -- no white flash, no mismatched double-skeleton.
export default function SuperAdminLoading() {
    return <SuperAdminDashboardSkeleton />;
}
