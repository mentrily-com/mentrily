'use client';

import React from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useSession } from '@/hooks/useSession';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
    const { shouldBlockRender } = useRoleGuard(['TEACHER', 'ADMIN']);
    const { data: sessionUser } = useSession();
    const skeletonRole = sessionUser?.role === 'ADMIN' ? 'admin' : 'teacher';

    // Blocks render only while genuinely unresolved (Clerk hasn't loaded) or
    // conclusively wrong (signed out, or a confirmed non-creator role) --
    // see the comment on `shouldBlockRender` in useRoleGuard. The much more
    // common "still verifying, but this is in fact a teacher/admin" window
    // falls through to rendering `{children}` immediately: the destination
    // page fetches its own data independently of this guard and shows its
    // own, better-fitted loading skeleton, instead of everyone seeing this
    // generic one first and then that one right after -- on every hard
    // refresh, not just right after signing in.
    //
    // AppShell already renders the real DashboardSidebar/DashboardTopbar around
    // this layout, so noNavbar keeps the skeleton from drawing a second,
    // redundant header on top of it.
    if (shouldBlockRender) return <DashboardSkeleton type="main" userRole={skeletonRole} noNavbar />;

    return <>{children}</>;
}
