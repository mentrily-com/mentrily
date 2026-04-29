'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import DashboardTopbar from '@/components/layout/DashboardTopbar';
import { useSession } from '@/hooks/useSession';

type ShellRole = 'student' | 'teacher' | 'admin' | 'super-admin' | null;

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: sessionUser } = useSession();
    const isCreatorWorkspace = pathname?.startsWith('/dashboard/creator');
    const isSuperAdminWorkspace = pathname?.startsWith('/dashboard/super-admin');
    const isPlaygroundRoute = pathname?.startsWith('/playground');
    const playgroundRole = React.useMemo<ShellRole>(() => {
        const backendRole = String(sessionUser?.role || '').toUpperCase();
        if (backendRole === 'SUPER_ADMIN') return 'super-admin';
        if (backendRole === 'ADMIN') return 'admin';
        if (backendRole === 'TEACHER') return 'teacher';
        if (backendRole === 'STUDENT' || backendRole === 'LEARNER') return 'student';
        return null;
    }, [sessionUser?.role]);
    const shouldUsePlaygroundWorkspaceShell =
        isPlaygroundRoute &&
        playgroundRole !== null &&
        playgroundRole !== 'student';
    const isWorkspaceRoute = Boolean(
        isCreatorWorkspace || isSuperAdminWorkspace || shouldUsePlaygroundWorkspaceShell,
    );
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
        return <>{children}</>;
    }

    const shellBackground = isCreatorWorkspace
        ? 'radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(249,115,22,0.08), transparent 24%), var(--color-bg-subtle)'
        : 'var(--color-bg-subtle)';
    const mainClassName = isPlaygroundRoute
        ? 'dashboard-content h-[calc(100vh-var(--topbar-height))] overflow-hidden'
        : 'dashboard-content';

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
                collapsed={collapsed}
                onCollapsedChange={setCollapsed}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <DashboardTopbar
                collapsed={collapsed}
                onMobileMenuClick={() => setMobileOpen(true)}
            />
            <main className={mainClassName}>{children}</main>
        </div>
    );
}

