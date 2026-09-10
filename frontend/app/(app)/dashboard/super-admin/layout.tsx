'use client';
import React from 'react';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { shouldBlockRender } = useRoleGuard(['SUPER_ADMIN']);

    // Blocks render only while genuinely unresolved (Clerk hasn't loaded) or
    // conclusively wrong (signed out, or a confirmed non-super-admin role) --
    // see the comment on `shouldBlockRender` in useRoleGuard. The much more
    // common "still verifying, but this is in fact a super admin" window
    // falls through to rendering `{children}` immediately: the destination
    // page fetches its own data independently of this guard and shows its
    // own, better-fitted loading skeleton, instead of everyone seeing this
    // generic one first and then that one right after -- on every hard
    // refresh, not just right after signing in.
    //
    // AppShell already renders the real DashboardSidebar/DashboardTopbar around
    // this layout, so noNavbar keeps the skeleton from drawing a second,
    // redundant header on top of it.
    if (shouldBlockRender) return <DashboardSkeleton type="main" userRole="super-admin" noNavbar />;

    return <>{children}</>;
}
