'use client';
import React, { useSyncExternalStore } from 'react';
import LearnerDashboardSkeleton from './LearnerDashboardSkeleton';
import CreatorDashboardSkeleton from './CreatorDashboardSkeleton';
import SuperAdminDashboardSkeleton from './SuperAdminDashboardSkeleton';
import SkeletonRoot from './SkeletonRoot';

interface DashboardSkeletonProps {
    type?: 'main' | 'list' | 'form';
    userRole?: 'student' | 'teacher' | 'admin' | 'super-admin';
    noNavbar?: boolean;
}

function resolveEffectiveRole(userRole?: string): 'student' | 'teacher' | 'admin' | 'super-admin' | null {
    if (userRole) {
        return userRole as 'student' | 'teacher' | 'admin' | 'super-admin';
    }
    if (typeof window !== 'undefined') {
        const pendingRaw = window.localStorage.getItem('pending-dashboard-role');
        if (pendingRaw) {
            try {
                const parsed = JSON.parse(pendingRaw);
                const role = String(parsed?.role || '').toUpperCase();
                if (role === 'STUDENT') return 'student';
                if (role === 'SUPER_ADMIN') return 'super-admin';
                if (role === 'ADMIN') return 'admin';
                if (role === 'TEACHER') return 'teacher';
            } catch {}
        }
        const stored = window.localStorage.getItem('user-role');
        if (stored === 'student') return 'student';
        if (stored === 'super-admin') return 'super-admin';
        if (stored === 'admin') return 'admin';
        if (stored === 'teacher') return 'teacher';
    }
    // Unknown role: a neutral backdrop beats guessing the creator layout for a learner.
    return null;
}

const noopSubscribe = () => () => {};

export default function DashboardSkeleton({ type = 'main', userRole, noNavbar = false }: DashboardSkeletonProps) {
    // The stored role only exists in the browser. Reading it during the
    // server render defaulted to the creator skeleton, so a learner's
    // hydration mismatched, React regenerated the tree, and both skeletons
    // were briefly mounted. Server + hydration render a neutral backdrop;
    // the role skeleton appears on the first client render.
    const clientRole = useSyncExternalStore(
        noopSubscribe,
        () => resolveEffectiveRole(userRole),
        () => userRole ?? null,
    );

    if (type === 'main') {
        if (!clientRole) {
            return <SkeletonRoot className="min-h-screen bg-slate-50" />;
        }
        const effective = clientRole;
        if (effective === 'student') {
            return <LearnerDashboardSkeleton />;
        }
        if (effective === 'super-admin') {
            return <SuperAdminDashboardSkeleton />;
        }
        return <CreatorDashboardSkeleton />;
    }

    return (
        <SkeletonRoot className="h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
            <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 overflow-hidden h-screen">
                {!noNavbar && (
                    <div className="flex items-center justify-between mb-10">
                        <div className="w-48 h-8 bg-slate-200 rounded-lg animate-pulse"></div>
                        <div className="w-64 h-12 bg-slate-200 rounded-2xl animate-pulse"></div>
                    </div>
                )}

                {type === 'list' && (
                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                <div className="w-32 h-4 bg-slate-200 rounded-md animate-pulse"></div>
                                <div className="w-24 h-4 bg-slate-200 rounded-md animate-pulse"></div>
                                <div className="flex gap-2">
                                    <div className="w-16 h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                                </div>
                            </div>

                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse"></div>
                                        <div className="space-y-2">
                                            <div className="w-48 h-5 bg-slate-200 rounded-md animate-pulse"></div>
                                            <div className="w-32 h-3 bg-slate-100 rounded-md animate-pulse"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 h-6 bg-slate-100 rounded-full animate-pulse"></div>
                                        <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {type === 'form' && (
                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                        <div className="w-48 h-8 bg-slate-200 rounded-lg animate-pulse mb-8"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="space-y-3">
                                    <div className="w-24 h-4 bg-slate-200 rounded-md animate-pulse"></div>
                                    <div className="w-full h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 space-y-3">
                            <div className="w-32 h-4 bg-slate-200 rounded-md animate-pulse"></div>
                            <div className="w-full h-32 bg-slate-100 rounded-xl animate-pulse"></div>
                        </div>
                        <div className="mt-8 flex justify-end gap-4">
                            <div className="w-24 h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                            <div className="w-32 h-12 bg-slate-200 rounded-xl animate-pulse"></div>
                        </div>
                    </div>
                )}
            </main>
        </SkeletonRoot>
    );
}
