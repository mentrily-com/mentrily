'use client';
import React from 'react';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import Navbar from '@/app/components/Navbar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const { shouldBlockRender } = useRoleGuard(['STUDENT']);

    // A fixed-height flex column, not `min-h-screen` -- Navbar's real height
    // varies (it grows for the impersonation/payment-failed banners, and
    // isn't pinned to any fixed px value), so pages below it that sized
    // themselves as "100dvh minus a hardcoded topbar height" could end up
    // taller than the viewport, pushing the whole document into an unwanted
    // outer scrollbar. `flex-1 min-h-0` here means the content area always
    // gets exactly "whatever's left under the navbar," however tall the
    // navbar actually rendered.
    //
    // The content slot itself scrolls (`overflow-y-auto`), not `hidden`:
    // most learner pages (dashboard, profile, bookmarks, certificates,
    // analytics, the course/module overview) are ordinary `min-h-screen`
    // pages that expect the page itself to grow and scroll -- `overflow-
    // hidden` here clipped them instead. The handful of pages built as a
    // fixed-viewport split view (unit, web-unit, reading, test-result) size
    // their own root to `h-full` and manage scrolling internally, so they
    // never overflow this wrapper and this scroll container never actually
    // engages for them -- one setting correctly serves both kinds of page.
    // Blocks render only while genuinely unresolved (Clerk hasn't loaded) or
    // conclusively wrong (signed out, or a confirmed non-student role) --
    // see the comment on `shouldBlockRender` in useRoleGuard. The much more
    // common "still verifying, but this is in fact a student" window falls
    // through to rendering `{children}` immediately: the destination page
    // fetches its own data independently of this guard and shows its own,
    // better-fitted loading skeleton, instead of everyone seeing this
    // generic one first and then that one right after -- on every hard
    // refresh, not just right after signing in.
    if (shouldBlockRender) {
        return (
            <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
                <Navbar userRole="student" />
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <DashboardSkeleton type="main" userRole="student" noNavbar />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <Navbar userRole="student" />
            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
    );
}
