'use client';

import CreatorDashboardSkeleton from '@/app/components/Skeletons/CreatorDashboardSkeleton';

// Matches what page.tsx renders while its data resolves
// (`if (loading && !stats) return <CreatorDashboardSkeleton />`). The
// /dashboard/creator/* sub-routes now carry their own matching loading.tsx,
// so this no longer has to be a generic shape that suits all of them.
export default function CreatorLoading() {
    return <CreatorDashboardSkeleton />;
}
