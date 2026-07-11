'use client';

import React from 'react';
import BrandedSpinner from '@/app/components/Common/BrandedSpinner';

// See app/(app)/loading.tsx — the learner dashboard renders its own
// DashboardSkeleton while its data fetch resolves, so this route-transition
// fallback stays a lightweight spinner instead of duplicating it.
export default function LearnerLoading() {
    return <BrandedSpinner />;
}
