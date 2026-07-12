'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import DashboardTopbar from '@/components/layout/DashboardTopbar';
import Navbar from '@/app/components/Navbar';
import { useSession } from '@/hooks/useSession';

type ShellRole = 'student' | 'teacher' | 'admin' | 'super-admin' | null;

function readPlaygroundHandoffRole(): ShellRole {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem('playground-workspace-role');
        if (!raw) return null;

        const parsed = JSON.parse(raw) as { role?: string; expiresAt?: number };
        const role = parsed?.role;
        const expiresAt = Number(parsed?.expiresAt || 0);

        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            window.localStorage.removeItem('playground-workspace-role');
            return null;
        }

        if (role === 'student' || role === 'teacher' || role === 'admin' || role === 'super-admin') {
            return role;
        }
    } catch {
        window.localStorage.removeItem('playground-workspace-role');
    }

    return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: sessionUser } = useSession();
    const isCreatorWorkspace = pathname?.startsWith('/dashboard/creator');
    const isSuperAdminWorkspace = pathname?.startsWith('/dashboard/super-admin');
    const isPlaygroundRoute = Boolean(pathname?.startsWith('/playground') && !pathname.startsWith('/playground/q'));
    const playgroundRole = React.useMemo<ShellRole>(() => {
        if (isPlaygroundRoute) {
            const handoffRole = readPlaygroundHandoffRole();
            if (handoffRole) return handoffRole;
        }

        const backendRole = String(sessionUser?.role || '').toUpperCase();
        if (backendRole === 'SUPER_ADMIN') return 'super-admin';
        if (backendRole === 'ADMIN') return 'admin';
        if (backendRole === 'TEACHER') return 'teacher';
        if (backendRole === 'STUDENT' || backendRole === 'LEARNER') return 'student';
        return null;
    }, [isPlaygroundRoute, sessionUser?.role]);
    const shouldUseLearnerPlaygroundShell = isPlaygroundRoute && playgroundRole === 'student';
    const shouldUsePlaygroundWorkspaceShell =
        isPlaygroundRoute && playgroundRole !== null && playgroundRole !== 'student';
    const isWorkspaceRoute = Boolean(isCreatorWorkspace || isSuperAdminWorkspace || shouldUsePlaygroundWorkspaceShell);
    const [collapsed, setCollapsed] = React.useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('dashboard-sidebar-collapsed') === 'true';
    });
    const [mobileOpen, setMobileOpen] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('dashboard-sidebar-collapsed', collapsed ? 'true' : 'false');
    }, [collapsed]);

    /* Close mobile drawer on route change */
    React.useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    if (!isWorkspaceRoute) {
        if (shouldUseLearnerPlaygroundShell) {
            return (
                <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
                    <Navbar userRole="student" />
                    <div className="relative h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
                        <main className="h-full min-h-0 overflow-hidden">{children}</main>
                    </div>
                </div>
            );
        }

        // Anonymous/no-role visitors to a playground route still need a real
        // height for PublicPlaygroundShell's `embedded` (h-full) sizing to
        // cascade into — without this, the shell has no ancestor height to
        // resolve against and collapses to its own content height instead of
        // filling the viewport. No Navbar here (unlike the learner branch
        // above): PublicPlaygroundShell already renders its own header /
        // sign-in affordances for anonymous visitors.
        if (isPlaygroundRoute) {
            return <div className="h-screen min-h-0 overflow-hidden bg-[#F8FAFC]">{children}</div>;
        }

        return <>{children}</>;
    }

    const shellBackground = isCreatorWorkspace
        ? 'radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(249,115,22,0.08), transparent 24%), var(--color-bg-subtle)'
        : 'var(--color-bg-subtle)';
    const mainClassName = isPlaygroundRoute
        ? 'dashboard-content h-[calc(100vh-var(--topbar-height))] overflow-hidden'
        : 'dashboard-content';
    const playgroundShellRole = isPlaygroundRoute && playgroundRole ? playgroundRole : undefined;

    return (
        <div
            className="min-h-screen"
            style={
                {
                    background: shellBackground,
                    '--sidebar-current-width': collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
                } as React.CSSProperties
            }
        >
            <DashboardSidebar
                userRole={playgroundShellRole}
                collapsed={collapsed}
                onCollapsedChange={setCollapsed}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <DashboardTopbar
                userRole={playgroundShellRole}
                collapsed={collapsed}
                onMobileMenuClick={() => setMobileOpen(true)}
            />
            <main className={mainClassName}>{children}</main>
        </div>
    );
}
