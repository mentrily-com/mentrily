'use client';

import React from 'react';
import CoursePlayerSkeleton from '@/app/components/Skeletons/CoursePlayerSkeleton';

export default function LearnerExamResultLoading() {
    return (
        <div className="min-h-screen flex flex-col bg-white overflow-hidden">
            <div className="flex-1 overflow-hidden">
                <CoursePlayerSkeleton hasSidebar={true} isExamMode={false} />
            </div>
        </div>
    );
}
