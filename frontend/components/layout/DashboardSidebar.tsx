'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    BookOpen,
    ClipboardList,
    Award,
    Users,
    PieChart,
    Settings,
    CreditCard,
    Building2,
    ChevronLeft,
    ChevronRight,
    Code,
    Globe,
    Terminal,
    Lock,
    Bookmark,
    BarChart3,
    User,
    UserPlus,
} from 'lucide-react';
import { useOrganization } from '@/app/context/OrganizationContext';
import { useSession } from '@/hooks/useSession';
import { BrandLockup } from '@/components/brand/BrandLockup';

/* ── Types ── */
type NavbarRole = 'student' | 'teacher' | 'admin' | 'super-admin';

interface NavGroupItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    badge?: string;
    disabled?: boolean;
    hidden?: boolean;
}

interface NavGroup {
    label?: string;
    items: NavGroupItem[];
}

interface DashboardSidebarProps {
    userRole?: NavbarRole;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

/* ── Icon wrapper for consistent sizing ── */
function N({ children }: { children: React.ReactNode }) {
    return <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">{children}</span>;
}

const iconSize = 18;

/* ── Navigation definitions per role ── */
function getNavGroups(role: NavbarRole, sessionUser: Record<string, unknown> | null): NavGroup[] {
    const plan = String(sessionUser?.plan || '').toUpperCase();
    const isEnterprise = plan === 'ENTERPRISE';
    const hasOrg = Boolean(String(sessionUser?.orgId || '').trim());
    const canManageTeacherBilling = sessionUser?.features
        ? (sessionUser.features as Record<string, unknown>)?.teacherSelfBilling !== false
        : true;

    if (role === 'super-admin') {
        return [
            {
                label: 'OVERVIEW',
                items: [
                    {
                        label: 'Dashboard',
                        path: '/dashboard/super-admin',
                        icon: (
                            <N>
                                <LayoutDashboard size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
            {
                label: 'MANAGEMENT',
                items: [
                    {
                        label: 'Organizations',
                        path: '/dashboard/super-admin/organizations',
                        icon: (
                            <N>
                                <Building2 size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'All Users',
                        path: '/dashboard/super-admin/users',
                        icon: (
                            <N>
                                <Users size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
            {
                items: [
                    {
                        label: 'Profile',
                        path: '/dashboard/super-admin/profile',
                        icon: (
                            <N>
                                <User size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
        ];
    }

    if (role === 'admin') {
        const items: NavGroup[] = [
            {
                label: 'OVERVIEW',
                items: [
                    {
                        label: 'Dashboard',
                        path: '/dashboard/creator',
                        icon: (
                            <N>
                                <LayoutDashboard size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
            {
                label: 'SCHOOL',
                items: [
                    {
                        label: 'Courses',
                        path: '/dashboard/creator/courses',
                        icon: (
                            <N>
                                <BookOpen size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'Exams',
                        path: '/dashboard/creator/exams',
                        icon: (
                            <N>
                                <ClipboardList size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'Certificates',
                        path: '/dashboard/creator/certificates',
                        icon: (
                            <N>
                                <Award size={iconSize} />
                            </N>
                        ),
                        badge: 'Soon',
                    },
                    {
                        label: 'Users',
                        path: '/dashboard/creator/users',
                        icon: (
                            <N>
                                <Users size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'Manage Users',
                        path: '/dashboard/creator/manage-users',
                        icon: (
                            <N>
                                <UserPlus size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
            {
                label: 'GROWTH',
                items: [
                    {
                        label: 'Analytics',
                        path: '/dashboard/creator/analytics',
                        icon: (
                            <N>
                                <PieChart size={iconSize} />
                            </N>
                        ),
                        badge: 'Pro',
                    },
                ],
            },
            {
                label: 'ACCOUNT',
                items: [
                    {
                        label: 'Billing & Plan',
                        path: '/dashboard/creator/billing',
                        icon: (
                            <N>
                                <CreditCard size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
        ];

        if (isEnterprise) {
            items.push({
                items: [
                    {
                        label: 'Settings',
                        path: '/dashboard/creator/settings',
                        icon: (
                            <N>
                                <Settings size={iconSize} />
                            </N>
                        ),
                        badge: 'Enterprise',
                    },
                ],
            });
        }

        items.push({
            items: [
                {
                    label: 'Profile',
                    path: '/dashboard/creator/profile',
                    icon: (
                        <N>
                            <User size={iconSize} />
                        </N>
                    ),
                },
            ],
        });

        return items;
    }

    if (role === 'teacher') {
        const items: NavGroup[] = [
            {
                label: 'OVERVIEW',
                items: [
                    {
                        label: 'Dashboard',
                        path: '/dashboard/creator',
                        icon: (
                            <N>
                                <LayoutDashboard size={iconSize} />
                            </N>
                        ),
                    },
                ],
            },
            {
                label: 'MY WORK',
                items: [
                    {
                        label: 'My Courses',
                        path: '/dashboard/creator/courses',
                        icon: (
                            <N>
                                <BookOpen size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'Exams',
                        path: '/dashboard/creator/exams',
                        icon: (
                            <N>
                                <ClipboardList size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'Certificates',
                        path: '/dashboard/creator/certificates',
                        icon: (
                            <N>
                                <Award size={iconSize} />
                            </N>
                        ),
                        badge: 'Soon',
                    },
                ],
            },
            {
                label: 'INSIGHTS',
                items: [
                    {
                        label: 'Users',
                        path: '/dashboard/creator/users',
                        icon: (
                            <N>
                                <Users size={iconSize} />
                            </N>
                        ),
                    },
                    {
                        label: 'Analytics',
                        path: '/dashboard/creator/analytics',
                        icon: (
                            <N>
                                <PieChart size={iconSize} />
                            </N>
                        ),
                        badge: 'Pro',
                    },
                ],
            },
        ];

        if (canManageTeacherBilling) {
            items.push({
                label: 'ACCOUNT',
                items: [
                    {
                        label: 'Billing & Plan',
                        path: '/dashboard/creator/billing',
                        icon: (
                            <N>
                                <CreditCard size={iconSize} />
                            </N>
                        ),
                    },
                ],
            });
        }

        if (isEnterprise) {
            items.push({
                items: [
                    {
                        label: 'Settings',
                        path: '/dashboard/creator/settings',
                        icon: (
                            <N>
                                <Settings size={iconSize} />
                            </N>
                        ),
                        badge: 'Enterprise',
                    },
                ],
            });
        }

        items.push({
            items: [
                {
                    label: 'Profile',
                    path: '/dashboard/creator/profile',
                    icon: (
                        <N>
                            <User size={iconSize} />
                        </N>
                    ),
                },
            ],
        });

        return items;
    }

    // student
    return [
        {
            items: [
                {
                    label: 'My Courses',
                    path: '/dashboard/learner',
                    icon: (
                        <N>
                            <BookOpen size={iconSize} />
                        </N>
                    ),
                },
                {
                    label: 'My Exams',
                    path: '/dashboard/learner/test',
                    icon: (
                        <N>
                            <ClipboardList size={iconSize} />
                        </N>
                    ),
                },
                {
                    label: 'Certificates',
                    path: '/dashboard/learner/certificates',
                    icon: (
                        <N>
                            <Award size={iconSize} />
                        </N>
                    ),
                },
                {
                    label: 'Bookmarks',
                    path: '/dashboard/learner/bookmarks',
                    icon: (
                        <N>
                            <Bookmark size={iconSize} />
                        </N>
                    ),
                },
                {
                    label: 'Analytics',
                    path: '/dashboard/learner/analytics',
                    icon: (
                        <N>
                            <BarChart3 size={iconSize} />
                        </N>
                    ),
                },
                {
                    label: 'Profile',
                    path: '/dashboard/learner/profile',
                    icon: (
                        <N>
                            <User size={iconSize} />
                        </N>
                    ),
                },
            ],
        },
    ];
}

/* ── Playground items ── */
const playgroundItems = [
    {
        label: 'Code Runner',
        path: '/playground',
        icon: (
            <N>
                <Code size={iconSize} />
            </N>
        ),
    },
    {
        label: 'Web Lab',
        path: '/playground/web',
        icon: (
            <N>
                <Globe size={iconSize} />
            </N>
        ),
    },
    {
        label: 'Notebook Lab',
        path: '/playground/pynb',
        icon: (
            <N>
                <Terminal size={iconSize} />
            </N>
        ),
    },
];

/* ── Component ── */
export default function DashboardSidebar({
    userRole,
    collapsed: collapsedProp,
    onCollapsedChange,
    mobileOpen = false,
    onMobileClose,
}: DashboardSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: sessionUser } = useSession();
    const { organization: orgContext } = useOrganization();
    const [localCollapsed, setLocalCollapsed] = useState(false);
    const [storedRole] = useState<NavbarRole | null>(() => {
        if (typeof window === 'undefined') return null;
        const savedRole = localStorage.getItem('user-role');
        return savedRole === 'student' ||
            savedRole === 'teacher' ||
            savedRole === 'admin' ||
            savedRole === 'super-admin'
            ? savedRole
            : null;
    });
    const collapsed = collapsedProp ?? localCollapsed;

    const setCollapsed = useCallback(
        (next: boolean) => {
            if (onCollapsedChange) {
                onCollapsedChange(next);
                return;
            }
            setLocalCollapsed(next);
        },
        [onCollapsedChange],
    );

    const role = useMemo<NavbarRole>(() => {
        const backendRole = String(sessionUser?.role || '').toUpperCase();
        const derivedRole =
            backendRole === 'SUPER_ADMIN'
                ? 'super-admin'
                : backendRole === 'ADMIN'
                  ? 'admin'
                  : backendRole === 'TEACHER'
                    ? 'teacher'
                    : backendRole === 'LEARNER' || backendRole === 'STUDENT'
                      ? 'student'
                      : null;

        if (userRole) return userRole;
        if (pathname?.startsWith('/dashboard/super-admin')) return 'super-admin';
        if (pathname?.startsWith('/dashboard/creator')) {
            if (derivedRole === 'admin' || derivedRole === 'teacher') return derivedRole;
            return 'teacher';
        }
        if (pathname?.startsWith('/dashboard/learner')) return 'student';
        if (pathname?.startsWith('/playground')) {
            if (derivedRole) return derivedRole;
            if (storedRole) return storedRole;
            return 'teacher';
        }
        return 'student';
    }, [userRole, pathname, sessionUser?.role, storedRole]);

    const navGroups = useMemo(
        () => getNavGroups(role, sessionUser as Record<string, unknown> | null),
        [role, sessionUser],
    );
    const hasCreatorRole =
        String(sessionUser?.role || '').toUpperCase() === 'ADMIN' ||
        String(sessionUser?.role || '').toUpperCase() === 'TEACHER';
    const isCreatorRole = role === 'teacher' || role === 'admin';
    const isCreatorSessionPending = Boolean(pathname?.startsWith('/dashboard/creator')) && !hasCreatorRole;
    const isPlanPending = isCreatorRole && !sessionUser?.plan;
    const showNavSkeleton = isCreatorSessionPending || isPlanPending;

    const isActive = useCallback(
        (path: string) => {
            if (!pathname) return false;
            // Exact match for dashboard home
            if (path === '/dashboard/creator' && pathname === '/dashboard/creator') return true;
            if (path === '/dashboard/learner' && pathname === '/dashboard/learner') return true;
            if (path === '/dashboard/super-admin' && pathname === '/dashboard/super-admin') return true;
            // Courses sub-pages
            if (path === '/dashboard/creator/courses' && pathname.startsWith('/dashboard/creator/courses')) return true;
            // Prefix match for other paths
            if (path !== '/dashboard/creator' && path !== '/dashboard/learner' && path !== '/dashboard/super-admin') {
                return pathname.startsWith(path);
            }
            return false;
        },
        [pathname],
    );

    return (
        <>
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[998] lg:hidden animate-in fade-in"
                    onClick={onMobileClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-white border-r z-[999] flex flex-col transition-transform duration-250 ease-in-out lg:translate-x-0 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} ${collapsed ? '' : ''}`}
                style={{
                    width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
                    borderColor: 'var(--color-border-subtle)',
                }}
            >
                {/* ── Brand section ── */}
                <div
                    className="flex items-center gap-2.5 border-b shrink-0"
                    style={{
                        height: 'var(--topbar-height)',
                        borderColor: 'var(--color-border-subtle)',
                        padding: collapsed ? '0 12px' : '0 16px',
                    }}
                >
                    <button
                        type="button"
                        className="min-w-0 cursor-pointer"
                        onClick={() =>
                            router.push(
                                `/dashboard/${role === 'student' ? 'learner' : role === 'admin' || role === 'teacher' ? 'creator' : 'super-admin'}`,
                            )
                        }
                    >
                        <BrandLockup
                            orgName={orgContext?.name}
                            orgLogo={orgContext?.logo}
                            collapsed={collapsed}
                            defaultLogoClassName={collapsed ? 'h-9 w-9 max-w-none rounded-xl' : 'h-8 max-w-[158px]'}
                            textClassName="text-[13px]"
                            priority
                        />
                    </button>
                </div>

                {/* ── Navigation groups ── */}
                <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
                    {showNavSkeleton ? (
                        <div className="space-y-5 px-1.5 py-1">
                            {[0, 1, 2].map((groupIndex) => (
                                <div key={groupIndex}>
                                    {!collapsed && <div className="mb-3 h-3 w-20 rounded bg-slate-100" />}
                                    <div className="space-y-2">
                                        {[0, 1, 2].map((itemIndex) => (
                                            <div
                                                key={itemIndex}
                                                className="h-10 rounded-lg bg-slate-100/80 animate-pulse"
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        navGroups.map((group, gi) => {
                            const visibleItems = group.items.filter((item) => !item.hidden);

                            if (visibleItems.length === 0) {
                                return null;
                            }

                            return (
                                <div key={gi}>
                                    {group.label && !collapsed && (
                                        <p
                                            className="px-2.5 mb-2 text-[11px] font-semibold uppercase tracking-[0.04em]"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {group.label}
                                        </p>
                                    )}
                                    {collapsed && group.label && (
                                        <div
                                            className="h-px mx-2 mb-2"
                                            style={{ backgroundColor: 'var(--color-border-subtle)' }}
                                        />
                                    )}
                                    <div className="space-y-0.5">
                                        {visibleItems.map((item) => {
                                            const active = isActive(item.path);
                                            const isDisabled = item.disabled;

                                            return (
                                                <Link
                                                    key={item.path}
                                                    href={isDisabled ? '#' : item.path}
                                                    title={collapsed ? item.label : undefined}
                                                    className={`relative w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 text-sm font-medium cursor-pointer ${
                                                        isDisabled ? 'opacity-40 cursor-not-allowed' : ''
                                                    }`}
                                                    style={{
                                                        height: 40,
                                                        padding: collapsed ? '0 12px' : '0 12px',
                                                        justifyContent: collapsed ? 'center' : 'flex-start',
                                                        backgroundColor: active
                                                            ? 'var(--color-bg-blue-tint)'
                                                            : 'transparent',
                                                        color: active
                                                            ? 'var(--brand, #008D98)'
                                                            : 'var(--color-text-secondary)',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!active && !isDisabled) {
                                                            e.currentTarget.style.backgroundColor =
                                                                'var(--color-bg-muted)';
                                                            e.currentTarget.style.color = 'var(--color-text-primary)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!active) {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                                                        }
                                                    }}
                                                    onClick={(event) => {
                                                        if (isDisabled) event.preventDefault();
                                                    }}
                                                >
                                                    {/* Active indicator */}
                                                    {active && (
                                                        <span
                                                            className="absolute left-0 top-[8px] bottom-[8px] w-[2px] rounded-full"
                                                            style={{ backgroundColor: 'var(--brand, #008D98)' }}
                                                        />
                                                    )}

                                                    {/* Icon */}
                                                    <span
                                                        style={{
                                                            color: active
                                                                ? 'var(--brand, #008D98)'
                                                                : 'var(--color-text-muted)',
                                                        }}
                                                    >
                                                        {item.icon}
                                                    </span>

                                                    {/* Label */}
                                                    {!collapsed && <span className="truncate">{item.label}</span>}

                                                    {/* Badge */}
                                                    {!collapsed && item.badge && (
                                                        <span
                                                            className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
                                                            style={{
                                                                backgroundColor: 'var(--color-bg-muted)',
                                                                color: 'var(--color-text-muted)',
                                                            }}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    )}

                                                    {/* Disabled lock */}
                                                    {isDisabled && !collapsed && (
                                                        <Lock
                                                            size={12}
                                                            className="ml-auto"
                                                            style={{ color: 'var(--color-text-muted)' }}
                                                        />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* ── Playground section ── */}
                    <div className="pt-2">
                        {!collapsed && (
                            <div className="mx-1.5 mb-2 px-2.5">
                                <p
                                    className="text-[11px] font-semibold uppercase tracking-[0.04em]"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    PLAYGROUND LAB
                                </p>
                                <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                                    Test coding and web ideas quickly.
                                </p>
                            </div>
                        )}
                        {collapsed && (
                            <div className="h-px mx-2 mb-2" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                        )}
                        <div className="space-y-0.5">
                            {playgroundItems.map((item) => {
                                const active =
                                    pathname?.startsWith(item.path) &&
                                    (item.path === '/playground' ? pathname === '/playground' : true);
                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        title={collapsed ? item.label : undefined}
                                        className="relative w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 text-sm font-medium cursor-pointer"
                                        style={{
                                            height: 40,
                                            padding: '0 12px',
                                            justifyContent: collapsed ? 'center' : 'flex-start',
                                            backgroundColor: active ? 'var(--color-bg-blue-tint)' : 'transparent',
                                            color: active ? 'var(--brand, #008D98)' : 'var(--color-text-secondary)',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!active) {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-muted)';
                                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!active) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                                            }
                                        }}
                                        onClick={() => {
                                            localStorage.setItem(
                                                'playground-workspace-role',
                                                JSON.stringify({
                                                    role,
                                                    expiresAt: Date.now() + 30_000,
                                                }),
                                            );
                                            localStorage.setItem('user-role', role);
                                        }}
                                    >
                                        {active && (
                                            <span
                                                className="absolute left-0 top-[8px] bottom-[8px] w-[2px] rounded-full"
                                                style={{ backgroundColor: 'var(--brand, #008D98)' }}
                                            />
                                        )}
                                        <span
                                            style={{
                                                color: active ? 'var(--brand, #008D98)' : 'var(--color-text-muted)',
                                            }}
                                        >
                                            {item.icon}
                                        </span>
                                        {!collapsed && <span className="truncate">{item.label}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>

                {/* ── Collapse toggle ── */}
                <div className="shrink-0 px-2.5 pb-3 hidden lg:block">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-expanded={!collapsed}
                        style={{
                            height: 36,
                            backgroundColor: 'var(--color-bg-muted)',
                            color: 'var(--color-text-muted)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-border-subtle)';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-muted)';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>
            </aside>
        </>
    );
}
