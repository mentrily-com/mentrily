'use client';
import React from 'react';
import { Users, BookOpen, Shield, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import posthog from 'posthog-js';

interface QuickActionCardProps {
    title: string;
    desc: string;
    count: string;
    icon: any;
    color: string;
    link: string;
}

function QuickActionCard({ title, desc, count, icon, color, link }: QuickActionCardProps) {
    return (
        <Link href={link} className="block group">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all h-full">
                <div className="flex items-start justify-between mb-6">
                    <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}
                    >
                        {icon}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center -mr-2 group-hover:bg-slate-100 transition-colors">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-slate-400 group-hover:text-slate-600"
                        >
                            <path d="M7 17L17 7" />
                            <path d="M7 7h10v10" />
                        </svg>
                    </div>
                </div>
                <div>
                    <h4 className="text-lg font-black text-slate-800 mb-1 group-hover:text-[var(--brand)] transition-colors">
                        {title}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 mb-4">{desc}</p>
                    <span className="inline-block px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100">
                        {count}
                    </span>
                </div>
            </div>
        </Link>
    );
}

interface AdminDashboardViewProps {
    basePath?: string;
    organizationId?: string;
}

import { AdminService } from '@/services/api/AdminService';
import { useState } from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { usePlan } from '@/hooks/usePlan';
import OnboardingChecklist from '@/app/components/Common/OnboardingChecklist';
import OnboardingTour from '@/app/components/Common/OnboardingTour';
import PlanGate from '@/app/components/Common/PlanGate';
import { useQuery } from '@tanstack/react-query';

// ... (keep interface)

export default function AdminDashboardView({
    basePath = '/dashboard/creator',
    organizationId,
}: AdminDashboardViewProps) {
    const { limits, usage, plan } = usePlan();
    const [showUpgradeBanner, setShowUpgradeBanner] = useState(true);
    const [dismissOnboarding, setDismissOnboarding] = useState(false);
    const { data: dashboardData, isLoading: loading } = useQuery({
        queryKey: ['admin-dashboard', organizationId || 'default'],
        queryFn: async () => {
            const [stats, analytics, logs, onboarding] = await Promise.all([
                AdminService.getStats(organizationId),
                AdminService.getAnalytics(organizationId),
                AdminService.getSystemLogs(organizationId),
                AdminService.getOnboardingStatus(organizationId),
            ]);
            return { stats, analytics, logs, onboarding };
        },
    });

    const statsData = dashboardData?.stats;
    const analyticsData = dashboardData?.analytics;
    const lastUpdatedLabel = statsData?.generatedAt ? new Date(statsData.generatedAt).toLocaleString() : null;

    // Show loading ONLY if no data exists (first load)
    if (loading && !statsData) return <DashboardSkeleton type="main" userRole="admin" noNavbar />;

    const studentsUsed = Number((usage as any)?.students || 0);
    const storageUsed = Number((usage as any)?.storageMb || 0);
    const seatsUsed = Number((usage as any)?.seats || 0);

    const studentsLimit = Number((limits as any)?.students || 0);
    const storageLimit = Number((limits as any)?.storageMb || 0);
    const seatsLimit = Number((limits as any)?.seats || 0);

    const ratio = (used: number, limit: number) => {
        if (!Number.isFinite(limit) || limit <= 0) return 0;
        return Math.min(100, Math.round((used / limit) * 100));
    };

    const studentsPercent = ratio(studentsUsed, studentsLimit);
    const storagePercent = ratio(storageUsed, storageLimit);
    const seatsPercent = ratio(seatsUsed, seatsLimit);
    const highestPercent = Math.max(studentsPercent, storagePercent, seatsPercent);
    const isHardLimitReached = highestPercent >= 100;

    const getNextPlan = (currentPlan: string) => {
        if (currentPlan === 'FREE') return 'STARTER';
        if (currentPlan === 'STARTER') return 'PRO';
        if (currentPlan === 'PRO') return 'ENTERPRISE';
        return 'ENTERPRISE';
    };

    const nextPlan = getNextPlan(plan);

    const getBarColor = (percent: number) => {
        if (percent > 90) return 'bg-red-500';
        if (percent >= 70) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const stats = [
        {
            label: 'Enrolled Students',
            value: Number(statsData?.totalEnrolledStudents || 0).toString(),
            change: 'Roster',
            icon: <Users size={20} />,
            color: 'bg-[var(--brand-light)] text-[var(--brand)]',
        },
        {
            label: 'Avg Course Completion',
            value: `${Math.round(Number(statsData?.averageCourseCompletionPercent || 0))}%`,
            change: 'Progress',
            icon: <BookOpen size={20} />,
            color: 'bg-emerald-50 text-emerald-600',
        },
        {
            label: 'Active Sessions',
            value: statsData?.activeSessions?.toString() || '0',
            change: 'Live',
            icon: <Shield size={20} />,
            color: 'bg-rose-50 text-rose-600',
        },
        {
            label: 'Avg Exam Score',
            value: `${Math.round(Number(statsData?.averageExamScore || 0))}%`,
            change: 'Scores',
            icon: <TrendingUp size={20} />,
            color: 'bg-amber-50 text-amber-600',
        },
        {
            label: 'Total Exams',
            value: statsData?.totalExams?.toString() || '0',
            change: 'Exams',
            icon: <Shield size={20} />,
            color: 'bg-rose-50 text-rose-600',
        },
        {
            label: 'Total Courses',
            value: statsData?.totalCourses?.toString() || '0',
            change: 'Courses',
            icon: <TrendingUp size={20} />,
            color: 'bg-amber-50 text-amber-600',
        },
    ];

    const onboarding = dashboardData?.onboarding;
    const onboardingCreatedAt = onboarding?.createdAt ? new Date(onboarding.createdAt) : null;
    const within30Days = onboardingCreatedAt
        ? Date.now() - onboardingCreatedAt.getTime() <= 30 * 24 * 60 * 60 * 1000
        : false;
    const showOnboarding = within30Days && !dismissOnboarding && onboarding?.steps?.length;

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            {/* ignoreUserOnboardingFlag: keep this tour's completion
                independent of the shared backend flag other creator/admin
                tours used to write to — see dashboard/creator/page.tsx
                for the full explanation. */}
            <OnboardingTour
                tourId="admin_dashboard"
                ignoreUserOnboardingFlag
                steps={[
                    {
                        element: '[data-element-id="admin-overview-header"]',
                        title: 'Admin overview stays action-first',
                        description: 'This is your control point for capacity, performance, and setup progress.',
                    },
                    {
                        element: '[data-element-id="admin-onboarding-checklist"]',
                        title: 'Use the checklist once',
                        description: 'Core setup tasks stay grouped here until the workspace is ready for your team.',
                    },
                    {
                        element: '[data-element-id="admin-usage-panel"]',
                        title: 'Watch quotas before they block work',
                        description: 'Students, storage, and seat usage are surfaced here so upgrades are predictable.',
                    },
                ]}
            />

            <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 animate-fade-in">
                <div className="flex items-center justify-between mb-12" data-element-id="admin-overview-header">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Organization Admin</h1>
                        <p className="text-slate-400 font-bold text-sm mt-1">
                            Manage your organization&apos;s academic environment.
                        </p>
                    </div>
                    {lastUpdatedLabel && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Last updated: {lastUpdatedLabel}
                        </div>
                    )}
                </div>

                {showOnboarding && (
                    <div data-element-id="admin-onboarding-checklist">
                        <OnboardingChecklist
                            steps={onboarding.steps}
                            completedCount={onboarding.completedCount}
                            totalSteps={onboarding.totalSteps}
                            showDismiss={onboarding.completedCount === onboarding.totalSteps}
                            onDismiss={() => setDismissOnboarding(true)}
                        />
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                                    {stat.icon}
                                </div>
                                <span
                                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${stat.change.includes('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                                >
                                    {stat.change}
                                </span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                {stat.label}
                            </p>
                            <h3 className="text-2xl font-black text-slate-800">{stat.value}</h3>
                        </div>
                    ))}
                </div>

                <div
                    className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm mb-8"
                    data-element-id="admin-usage-panel"
                >
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-5">Plan Usage</h3>
                    <div className="space-y-5">
                        {[
                            { label: 'Students', used: studentsUsed, limit: studentsLimit, percent: studentsPercent },
                            { label: 'Storage (MB)', used: storageUsed, limit: storageLimit, percent: storagePercent },
                            { label: 'Team Seats', used: seatsUsed, limit: seatsLimit, percent: seatsPercent },
                        ].map((item) => {
                            const unlimited = item.limit <= 0;
                            return (
                                <div key={item.label} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                            {item.label}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-500">
                                            {unlimited ? `${item.used}` : `${item.used} / ${item.limit}`}
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${getBarColor(item.percent)}`}
                                            style={{ width: `${item.percent}%` }}
                                        />
                                    </div>
                                    {item.percent >= 70 && item.percent < 80 && (
                                        <p className="text-xs font-semibold text-slate-500">
                                            Growing fast? You’re at {item.percent}% usage.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {highestPercent >= 80 && highestPercent < 100 && showUpgradeBanner && (
                    <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-amber-900">
                            You’re nearing your plan limits. Upgrade to {nextPlan} for more capacity.
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="text-xs font-black uppercase tracking-widest text-slate-500 px-3 py-2"
                                onClick={() => setShowUpgradeBanner(false)}
                            >
                                Dismiss
                            </button>
                            <Link
                                href={`${basePath}/billing`}
                                onClick={() =>
                                    posthog.capture('plan_upgrade_clicked', {
                                        source: 'admin_dashboard_banner',
                                        targetPlan: nextPlan,
                                    })
                                }
                                className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-widest px-4 py-2"
                            >
                                Upgrade
                            </Link>
                        </div>
                    </div>
                )}

                {plan === 'FREE' && (
                    <div className="mb-12 bg-white rounded-[24px] border border-slate-100 p-6 shadow-sm">
                        <h3 className="text-base font-black text-slate-900 mb-4">Team Members</h3>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                            <p className="text-sm font-semibold text-slate-600">
                                Upgrade to Starter to invite teachers to your school.
                            </p>
                            <Link
                                href={`${basePath}/billing`}
                                onClick={() =>
                                    posthog.capture('plan_upgrade_clicked', {
                                        source: 'admin_dashboard_team_lock',
                                        targetPlan: 'STARTER',
                                    })
                                }
                                className="mt-4 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--brand-dark)]"
                            >
                                Upgrade to Starter
                            </Link>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Analytics */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Activity Overview</h3>
                                <select className="bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-2 rounded-xl outline-none">
                                    <option>Last 7 Days</option>
                                    <option>Last 30 Days</option>
                                </select>
                            </div>
                            <div className="h-64 flex items-end justify-between gap-2 px-2">
                                {loading ? (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest">
                                        Loading Activity...
                                    </div>
                                ) : (
                                    (analyticsData?.activity || [0, 0, 0, 0, 0, 0, 0]).map((h: number, i: number) => {
                                        const max = Math.max(...(analyticsData?.activity || [1]), 1);
                                        const heightPercent = (h / max) * 100;
                                        return (
                                            <div
                                                key={i}
                                                className="flex-1 bg-[var(--brand-light)] rounded-t-xl relative group transition-all hover:bg-[var(--brand)]/20"
                                                style={{ height: `${heightPercent}%` }}
                                            >
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {h}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="flex justify-between mt-4 px-2">
                                {(analyticsData?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map(
                                    (d: string) => (
                                        <span key={d} className="text-[10px] font-black text-slate-300 uppercase">
                                            {d}
                                        </span>
                                    ),
                                )}
                            </div>
                        </div>

                        {/* Quick View Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <QuickActionCard
                                title="Manage Teachers"
                                desc="View profiles and assigned courses"
                                count="42 Instructors"
                                icon={<Users size={24} />}
                                color="text-emerald-600 bg-emerald-50"
                                link={`${basePath}/users?type=teacher`}
                            />
                            <PlanGate feature="advancedAnalytics" requiredPlan="PRO">
                                <QuickActionCard
                                    title="Organization Trends"
                                    desc="Student engagement metrics"
                                    count="+18.4% growth"
                                    icon={<TrendingUp size={24} />}
                                    color="text-[var(--brand)] bg-[var(--brand-light)]"
                                    link={`${basePath}/analytics`}
                                />
                            </PlanGate>
                        </div>
                    </div>

                    {/* Right: Real-time Monitor Preview */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white space-y-8 overflow-hidden relative">
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black tracking-tight">Live Status</h3>
                                <div className="flex items-center gap-2 px-3 py-1 bg-rose-500 rounded-full animate-pulse">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Live Now</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Active Exam
                                        </span>
                                        <span className="text-[10px] font-black text-emerald-400">85% Attendance</span>
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Full Stack Development Final</h4>
                                    <p className="text-xs text-slate-400">Ends in 45 mins</p>
                                </div>

                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 opacity-60">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Up Next
                                        </span>
                                        <span className="text-[10px] font-black text-amber-400">Starts 2:00 PM</span>
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Python Basics Quiz</h4>
                                    <p className="text-xs text-slate-400">120 Students Enrolled</p>
                                </div>
                            </div>

                            <Link
                                href={`${basePath}/exams`}
                                className="block w-full py-4 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all text-center mt-6"
                            >
                                View Exam Monitor
                            </Link>
                        </div>

                        {/* Decor */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand)]/20 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none"></div>
                    </div>
                </div>
            </main>

            {isHardLimitReached && (
                <div className="fixed inset-0 z-[2100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="w-full max-w-[560px] bg-white rounded-2xl border border-red-200 shadow-xl p-7">
                        <h3 className="text-lg font-black text-red-600">Plan Limit Reached</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Your organization has reached a quota limit. Upgrade to {nextPlan} to continue without
                            interruptions.
                        </p>
                        <div className="mt-5 rounded-lg bg-slate-50 border border-slate-200 p-4">
                            <p className="text-xs font-semibold text-slate-600">
                                Current plan: <span className="font-black text-slate-800">{plan}</span>
                            </p>
                            <p className="text-xs font-semibold text-slate-600 mt-1">
                                Recommended: <span className="font-black text-[var(--brand)]">{nextPlan}</span>
                            </p>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <Link
                                href={`${basePath}/billing`}
                                onClick={() =>
                                    posthog.capture('plan_upgrade_clicked', {
                                        source: 'admin_dashboard_hard_limit',
                                        targetPlan: nextPlan,
                                    })
                                }
                                className="rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest px-4 py-2"
                            >
                                Upgrade Now
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
