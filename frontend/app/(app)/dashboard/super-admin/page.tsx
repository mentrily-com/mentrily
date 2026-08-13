'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Building2,
    Users,
    ShieldAlert,
    ArrowUpRight,
    Plus,
    Trash2,
    Bug,
    CheckCircle2,
    X,
    ArrowLeft,
    Download,
    CreditCard,
    AlertTriangle,
    Pencil,
} from 'lucide-react';
import { SuperAdminService } from '@/services/api/SuperAdminService';
import { useRequireAuth } from '@/hooks/requireAuthClient';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import DOMPurify from '@/lib/dompurify';

export default function SuperAdminDashboardPage() {
    const [statsData, setStatsData] = useState<any>(null);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [bugReports, setBugReports] = useState<any[]>([]);
    const [bugFilter, setBugFilter] = useState<'OPEN' | 'FIXED'>('OPEN');
    const [selectedBug, setSelectedBug] = useState<any | null>(null);
    const [selectedImage, setSelectedImage] = useState<{ url: string; name?: string } | null>(null);
    const [loadingBugs, setLoadingBugs] = useState(true);
    const [loading, setLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const isSignedIn = useRequireAuth('/login');

    useEffect(() => {
        if (!isSignedIn) return;
        setAuthChecked(true);
        async function load() {
            try {
                const [s, o] = await Promise.all([SuperAdminService.getStats(), SuperAdminService.getOrganizations()]);
                setStatsData(s);
                setOrganizations(o);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [isSignedIn]);

    useEffect(() => {
        if (!authChecked) return;
        async function loadBugs() {
            setLoadingBugs(true);
            try {
                const response = await SuperAdminService.getBugReports({ status: bugFilter, limit: 50 });
                setBugReports(response?.data || []);
            } catch (error) {
                console.error(error);
            } finally {
                setLoadingBugs(false);
            }
        }
        loadBugs();
    }, [authChecked, bugFilter]);

    const globalStats = [
        {
            label: 'Total Organizations',
            value: statsData?.totalOrgs?.toString() || '0',
            hint: 'Platform',
            icon: <Building2 size={17} />,
            chipClass: 'bg-sky-50 text-sky-700',
        },
        {
            label: 'Active Paying Orgs',
            value: statsData?.totalPayingOrgs?.toString() || '0',
            hint: 'Revenue',
            icon: <CreditCard size={17} />,
            chipClass: 'bg-emerald-50 text-emerald-700',
        },
        {
            label: 'Failed Payments (30d)',
            value: statsData?.failedPayments30d?.toString() || '0',
            hint: 'Billing',
            icon: <AlertTriangle size={17} />,
            chipClass:
                Number(statsData?.failedPayments30d || 0) > 0
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-slate-50 text-slate-500',
        },
        {
            label: 'Total Students',
            value: statsData?.totalStudents?.toString() || '0',
            hint: 'Learners',
            icon: <Users size={17} />,
            chipClass: 'bg-indigo-50 text-indigo-700',
        },
    ];

    const orgsByPlan = statsData?.orgsByPlan || { FREE: 0, STARTER: 0, PRO: 0, ENTERPRISE: 0 };
    const anyCriticalOrg = organizations.some((org: any) => org.hasCriticalUsage);
    const showHealthAlert = Number(statsData?.failedPayments30d || 0) > 0 || anyCriticalOrg;

    if (!authChecked || loading) return <DashboardSkeleton type="main" userRole="super-admin" />;

    return (
        <div className="space-y-6 text-slate-900 selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)] animate-fade-in">
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white px-6 py-7 shadow-[0_16px_50px_rgba(15,23,42,0.08)] lg:px-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(26,86,219,0.09),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.07),_transparent_38%)]" />
                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">
                                    <ShieldAlert size={13} />
                                    Super Admin
                                </span>
                            </div>
                            <h1 className="max-w-4xl font-display text-3xl font-medium tracking-tight text-slate-950 lg:text-5xl">
                                System infrastructure and multi-tenant management.
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-slate-600 lg:text-base">
                                Monitor organizations, review billing health, and manage platform-wide operations from one unified control center.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/dashboard/super-admin/organizations/new"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(26,86,219,0.24)] transition-all duration-200 hover:brightness-110"
                            >
                                <Plus size={15} />
                                Deploy New Organization
                            </Link>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {globalStats.map((card) => (
                                <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.chipClass}`}>
                                            {card.icon}
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            {card.hint}
                                        </span>
                                    </div>
                                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                        {card.label}
                                    </p>
                                    <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Plan Distribution Panel */}
                    <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Plan Distribution</p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Organization tiers</h2>
                            </div>
                        </div>
                        <div className="mt-5 space-y-4">
                            {Object.entries(orgsByPlan).map(([plan, count]) => {
                                const total = Math.max(Number(statsData?.totalOrgs || 0), 1);
                                const percent = Math.round((Number(count || 0) / total) * 100);
                                return (
                                    <div key={plan} className="space-y-2">
                                        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-300">
                                            <span>{plan}</span>
                                            <span>{String(count)} ({percent}%)</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-300 to-emerald-300 transition-all duration-500"
                                                style={{ width: `${percent > 0 ? Math.max(percent, 5) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-5 rounded-2xl border border-white/12 bg-white/5 p-4">
                            <p className="text-sm font-semibold text-white">Platform health</p>
                            <p className="mt-1 text-xs leading-6 text-slate-300">
                                {showHealthAlert
                                    ? 'Some organizations require attention. Review health alerts below.'
                                    : 'All organizations are operating within normal parameters.'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Health Alert Banner */}
            {showHealthAlert && (
                <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                            <ShieldAlert size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-rose-900">Platform Health Alert</p>
                            <p className="mt-1 text-xs leading-6 text-rose-700">
                                {Number(statsData?.failedPayments30d || 0) > 0
                                    ? `${statsData?.failedPayments30d || 0} failed payment event(s) detected in the last 30 days.`
                                    : 'One or more organizations are above 90% quota usage.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Grid: Organizations + Sidebar */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                {/* Organizations List */}
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Directory</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                                Manage every organization from one board.
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                Monitor usage, switch statuses, and open admin views directly from this list.
                            </p>
                        </div>
                        <Link
                            href="/dashboard/super-admin/organizations/new"
                            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                        >
                            <Plus size={14} />
                            New Organization
                        </Link>
                    </div>

                    <div className="mt-6 space-y-3">
                        {organizations.length > 0 ? (
                            organizations.map((org: any) => (
                                <OrgRow
                                    key={org.id}
                                    org={org}
                                    onDelete={async () => {
                                        if (confirm(`Are you sure you want to delete ${org.name}?`)) {
                                            try {
                                                await SuperAdminService.deleteOrganization(org.id);
                                                setOrganizations((prev) => prev.filter((o) => o.id !== org.id));
                                            } catch (e) {
                                                alert('Failed to delete organization');
                                            }
                                        }
                                    }}
                                    onToggleStatus={async () => {
                                        try {
                                            const newStatus = org.status === 'Active' ? 'Suspended' : 'Active';
                                            await SuperAdminService.updateOrganization(org.id, {
                                                status: newStatus,
                                            });
                                            setOrganizations((prev) =>
                                                prev.map((o) =>
                                                    o.id === org.id ? { ...o, status: newStatus } : o,
                                                ),
                                            );
                                        } catch (e) {
                                            alert('Failed to update status');
                                        }
                                    }}
                                />
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-9 text-center">
                                <h3 className="text-lg font-semibold text-slate-900">No organizations found.</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    Deploy your first organization to get started.
                                </p>
                                <div className="mt-5">
                                    <Link
                                        href="/dashboard/super-admin/organizations/new"
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white"
                                    >
                                        <Plus size={14} />
                                        Deploy Organization
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Sidebar: Recent Billing Events */}
                <div className="space-y-6">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Billing</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Recent Billing Events</h2>
                        <div className="mt-5 space-y-3">
                            {(statsData?.recentEvents || []).slice(0, 6).map((event: any) => (
                                <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                                    <div className="flex items-start gap-3">
                                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-700">
                                            <CreditCard size={15} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{event.eventType}</p>
                                            <p className="mt-1 text-xs text-slate-600">{event.orgName}</p>
                                            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                                                {new Date(event.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!statsData?.recentEvents || statsData.recentEvents.length === 0) && (
                                <p className="text-sm text-slate-500">No recent billing events.</p>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Bug Reports Section */}
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Issue tracker</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Reported Bugs</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            User-submitted issues from student, teacher, and organization admin profiles.
                        </p>
                    </div>

                    <div className="inline-flex rounded-full bg-slate-100 p-1">
                        {(['OPEN', 'FIXED'] as const).map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setBugFilter(status)}
                                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${bugFilter === status ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {status === 'OPEN' ? 'Open' : 'Fixed'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6">
                    {loadingBugs ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-24 rounded-2xl bg-slate-50 animate-pulse" />
                            ))}
                        </div>
                    ) : bugReports.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-9 text-center">
                            <Bug size={28} className="mx-auto text-slate-300 mb-3" />
                            <h3 className="text-lg font-semibold text-slate-900">
                                No {bugFilter === 'OPEN' ? 'open' : 'fixed'} bug reports
                            </h3>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {bugReports.map((bug) => (
                                <div
                                    key={bug.id}
                                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors duration-200 hover:bg-white"
                                >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate text-base font-semibold text-slate-950">{bug.title}</h3>
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${bug.status === 'FIXED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                                                >
                                                    {bug.status}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                <span>{bug.reporter?.name || 'Unknown'}</span>
                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                <span>{bug.reporter?.role || bug.reporterRole}</span>
                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                <span>{bug.reporter?.organization?.name || 'No org'}</span>
                                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                <span>
                                                    {new Date(bug.createdAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                onClick={() => setSelectedBug(bug)}
                                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                            >
                                                View Details
                                            </button>
                                            {bug.status !== 'FIXED' && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await SuperAdminService.markBugReportFixed(bug.id);
                                                            setBugReports((prev) =>
                                                                prev.map((b) =>
                                                                    b.id === bug.id
                                                                        ? { ...b, status: 'FIXED', fixedAt: new Date().toISOString() }
                                                                        : b,
                                                                ),
                                                            );
                                                        } catch (error) {
                                                            alert('Failed to mark as fixed');
                                                        }
                                                    }}
                                                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    Mark Fixed
                                                </button>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Delete this bug report?')) return;
                                                    try {
                                                        await SuperAdminService.deleteBugReport(bug.id);
                                                        setBugReports((prev) => prev.filter((b) => b.id !== bug.id));
                                                    } catch (error) {
                                                        alert('Failed to delete bug report');
                                                    }
                                                }}
                                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Bug Detail Modal */}
            {selectedBug && (
                <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
                    <div className="w-full max-w-4xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] max-h-[88vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{selectedBug.title}</h3>
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${selectedBug.status === 'FIXED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                                    >
                                        {selectedBug.status}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    {selectedBug.reporter?.name || 'Unknown'} •{' '}
                                    {selectedBug.reporter?.role || selectedBug.reporterRole} •{' '}
                                    {selectedBug.reporter?.organization?.name || 'No org'} •{' '}
                                    {new Date(selectedBug.createdAt).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedBug(null)}
                                className="cursor-pointer inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div
                            className="prose prose-slate max-w-none text-sm font-medium text-slate-700"
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(String(selectedBug.description || '')),
                            }}
                        />

                        {Array.isArray(selectedBug.attachments) && selectedBug.attachments.length > 0 && (
                            <div className="mt-8">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-3">
                                    Attached Images
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {selectedBug.attachments.map((att: any, idx: number) => (
                                        <button
                                            key={idx}
                                            onClick={() =>
                                                setSelectedImage({
                                                    url: att.url,
                                                    name: att.name || `Attachment ${idx + 1}`,
                                                })
                                            }
                                            className="cursor-pointer relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50 h-32 text-left"
                                        >
                                            <img
                                                src={att.url}
                                                alt={att.name || `Attachment ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Image Viewer */}
            {selectedImage && (
                <div className="fixed inset-0 z-[2200] bg-slate-950/95 flex flex-col">
                    <div className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/10">
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="cursor-pointer px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-[0.16em] flex items-center gap-2 transition-colors"
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                        <a
                            href={selectedImage.url}
                            download={selectedImage.name || 'bug-report-image'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white text-xs font-semibold uppercase tracking-[0.16em] flex items-center gap-2 transition-colors hover:brightness-110"
                        >
                            <Download size={14} /> Download
                        </a>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4 md:p-8">
                        <img
                            src={selectedImage.url}
                            alt={selectedImage.name || 'Bug attachment'}
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Sub-components ── */

function OrgRow({ org, onDelete, onToggleStatus }: any) {
    const { name, status, plan, usagePercent } = org;
    const users = org?._count?.users || 0;

    const usageBars = [
        { label: 'Students', value: Number(usagePercent?.students || 0) },
        { label: 'Storage', value: Number(usagePercent?.storage || 0) },
        { label: 'Seats', value: Number(usagePercent?.seats || 0) },
    ];

    const getUsageColor = (value: number) => {
        if (value > 90) return 'bg-rose-500';
        if (value >= 70) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors duration-200 hover:bg-white group">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white text-sm font-semibold">
                        {name?.[0] || 'O'}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-slate-950">{name}</h3>
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                {plan}
                            </span>
                            <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                            >
                                {status}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{users} Users</span>
                        </div>
                        <div className="mt-3 space-y-2 max-w-[260px]">
                            {usageBars.map((bar) => (
                                <div key={bar.label}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{bar.label}</span>
                                        <span className="text-[10px] font-semibold text-slate-500">{bar.value}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${getUsageColor(bar.value)}`}
                                            style={{ width: `${bar.value}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/dashboard/super-admin/organizations/${org.id}/dashboard`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <ShieldAlert size={14} />
                        Dashboard
                    </Link>
                    <Link
                        href={`/dashboard/super-admin/organizations/${org.id}/edit`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <Pencil size={14} />
                        Edit
                    </Link>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleStatus();
                        }}
                        className={`cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${status === 'Active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                    >
                        {status === 'Active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                    >
                        <Trash2 size={14} />
                    </button>
                    <Link
                        href={`/dashboard/super-admin/organizations/${org.id}/dashboard`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-transparent bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                        <ArrowUpRight size={14} />
                        Enter
                    </Link>
                </div>
            </div>
        </div>
    );
}
