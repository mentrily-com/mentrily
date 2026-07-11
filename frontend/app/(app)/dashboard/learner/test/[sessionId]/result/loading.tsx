'use client';

import React from 'react';
import BrandedSpinner from '@/app/components/Common/BrandedSpinner';

// See app/(app)/loading.tsx — the result page renders its own
// CoursePlayerSkeleton while it loads, so this route-transition fallback
// stays a lightweight spinner instead of duplicating it.
export default function LearnerExamResultLoading() {
    return <BrandedSpinner />;
}
