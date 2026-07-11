'use client';

import React from 'react';
import CoursePlayerSkeleton from '@/app/components/Skeletons/CoursePlayerSkeleton';

// Matches the skeleton the page itself renders while its data fetch
// resolves, so the route-transition fallback and the page's own loading
// state are the same visual — no white flash, no mismatched double-skeleton.
export default function LearnerExamResultLoading() {
    return (
        <div className="min-h-screen flex flex-col bg-white overflow-hidden">
            <div className="flex-1 overflow-hidden">
                <CoursePlayerSkeleton hasSidebar={true} isExamMode={false} />
            </div>
        </div>
    );
}
