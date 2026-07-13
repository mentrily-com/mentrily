'use client';

import React from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { motion } from 'framer-motion';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import OnboardingTour from '@/app/components/Common/OnboardingTour';
import AppModal from '@/app/components/Common/AppModal';
import StudioRecentActivity from './_components/StudioRecentActivity';
import { useStudioDashboard } from './_components/useStudioDashboard';
import { usePlan } from '@/hooks/usePlan';
import { useSession } from '@/hooks/useSession';
import {
    AlertTriangle,
    ArrowUpRight,
    Award,
    BarChart3,
    BookOpen,
    ClipboardList,
    Plus,
    Search,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Users,
} from 'lucide-react';

/* ── Animation variants ── */
const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
    }),
};

const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: (i: number) => ({
        opacity: 1,
        scale: 1,
        transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
    }),
};

type StudioModule = {
    id: string;
    title?: string;
    status?: string;
    students?: number;
    modules?: number;
    linkedExamId?: string;
    certificateTemplateId?: string;
    lastUpdated?: string;
};

export default function TeacherDashboardPage() {
    const { filteredModules, recentActivity, searchQuery, setSearchQuery, setTab, stats, tab, loading } =
        useStudioDashboard();
    const { limits, usage, plan, role } = usePlan();
    const { data: session } = useSession();
    const [showUpgradeBanner, setShowUpgradeBanner] = React.useState(true);
    const dashboardRole = role === 'ADMIN' ? 'admin' : 'teacher';
    const hasOrg = Boolean(String(session?.orgId || '').trim());

    if (loading && !stats) return <DashboardSkeleton type="main" userRole={dashboardRole} />;

    const usageRecord = (usage ?? {}) as Record<string, number | string | undefined>;
    const limitsRecord = (limits ?? {}) as Record<string, number | string | undefined>;
    const statsRecord = (stats ?? {}) as Record<string, number | string | undefined>;

    const studentsUsed = Number(usageRecord.students || 0);
    const storageUsed = Number(usageRecord.storageMb || 0);
    const storageLimit = Number(limitsRecord.storageMb || 0);
    const coursesUsed = Number(usageRecord.courses || 0);
    const coursesLimit = Number(limitsRecord.courses || 0);

    const ratio = (used: number, limit: number) => {
        if (!Number.isFinite(limit) || limit <= 0) return 0;
        return Math.min(100, Math.round((used / limit) * 100));
    };

    const coursesPercent = ratio(coursesUsed, coursesLimit);
    const storagePercent = ratio(storageUsed, storageLimit);
    const highestCapacityPercent = Math.max(coursesPercent, storagePercent);
    const hasHardLimitBreach =
        (coursesLimit > 0 && coursesUsed > coursesLimit) || (storageLimit > 0 && storageUsed > storageLimit);
    const nextPlan = plan === 'FREE' ? 'STARTER' : plan === 'STARTER' ? 'PRO' : 'ENTERPRISE';

    const statCards = [
        {
            label: 'Learners',
            value: studentsUsed,
            hint: 'Active roster',
            icon: <Users size={18} />,
            gradient: 'from-sky-500/10 to-blue-500/10',
            iconColor: 'text-sky-600',
        },
        {
            label: 'Courses',
            value: Number(stats?.activeCourses || 0),
            hint: 'Published + draft',
            icon: <BookOpen size={18} />,
            gradient: 'from-emerald-500/10 to-teal-500/10',
            iconColor: 'text-emerald-600',
        },
        {
            label: 'Exams',
            value: Number(stats?.totalExams || 0),
            hint: 'This workspace',
            icon: <ClipboardList size={18} />,
            gradient: 'from-indigo-500/10 to-violet-500/10',
            iconColor: 'text-indigo-600',
        },
        {
            label: 'Certificates',
            value: Number(statsRecord.certificatesIssued || 0),
            hint: 'Issued',
            icon: <Award size={18} />,
            gradient: 'from-amber-500/10 to-orange-500/10',
            iconColor: 'text-amber-600',
        },
    ];

    const modules = (filteredModules || []) as StudioModule[];

    return (
        <div className="space-y-5 text-slate-900 selection:bg-[var(--brand-light)] selection:text-[var(--brand-dark)]">
            {/* ignoreUserOnboardingFlag: this tour must not share the backend
                User.hasCompletedOnboarding flag with the other creator/admin
                tours (course builder, admin org view) — that flag is a single
                global boolean, so completing/skipping any one of them would
                permanently suppress the others even on a genuine first visit.
                Each tour tracks its own completion via its per-tourId
                localStorage key instead (same fix already applied to the
                learner tours — see dashboard/learner/page.tsx). */}
            <OnboardingTour
                tourId="creator_dashboard"
                ignoreUserOnboardingFlag
                steps={[
                    {
                        element: '[data-element-id="creator-studio-hero"]',
                        title: 'Welcome to your Creator Studio',
                        description:
                            'This is home base: plan courses, schedule exams, and watch learner activity without leaving the page. Let’s take a 60-second lap around it.',
                        side: 'bottom',
                    },
                    {
                        element: '[data-element-id="create-course-btn"]',
                        title: 'Start with a course',
                        description:
                            'One click opens the course builder — add sections, lessons, and practice questions there. Your first course is the natural first step.',
                        side: 'bottom',
                    },
                    {
                        element: '[data-element-id="create-exam-btn"]',
                        title: 'Then attach an exam',
                        description:
                            'Exams can stand alone or link to a course. Scheduling, access rules, tab-switch limits, and proctoring all live in the exam editor.',
                        side: 'bottom',
                    },
                    {
                        element: '[data-element-id="creator-stats"]',
                        title: 'Your numbers at a glance',
                        description:
                            'Learners, courses, exams, and issued certificates update live here — a quick health check every time you land on the studio.',
                        side: 'bottom',
                    },
                    {
                        element: '[data-element-id="creator-capacity"]',
                        title: 'Capacity before it becomes a blocker',
                        description:
                            'Student seats and storage are tracked against your plan, so you’ll see limits approaching long before publishing gets interrupted.',
                        side: 'top',
                    },
                    {
                        element: '[data-element-id="creator-content-pipeline"]',
                        title: 'Everything you’re building, one board',
                        description:
                            'Flip between Published and Draft, search by name, and jump into editing a course or its linked exam from the same row.',
                        side: 'top',
                    },
                    {
                        element: '[data-element-id="creator-recent-activity"]',
                        title: 'Learner signals while you build',
                        description:
                            'Submissions, completions, and certificates stream in here, so you never have to leave authoring to check on your class.',
                        side: 'left',
                    },
                    {
                        element: '[data-element-id="creator-workflow"]',
                        title: 'Ready to go deeper?',
                        description:
                            'The workflow cards outline the create → assess → certify loop, and Open Analytics gives you per-course performance. That’s the tour — build something great!',
                        side: 'top',
                    },
                ]}
            />

            {/* ═══════════════ HERO ═══════════════ */}
            <motion.section
                data-element-id="creator-studio-hero"
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="glass-card relative overflow-hidden rounded-2xl p-5 shadow-[0_8px_32px_rgba(15,23,42,0.06)] sm:p-6 lg:rounded-3xl lg:p-8"
            >
                {/* Animated gradient mesh */}
                <div className="animate-gradient-shift pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--brand)]/[0.06] via-transparent to-emerald-500/[0.05]" />
                <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--brand)]/[0.04] blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-500/[0.03] blur-3xl" />

                <div className="relative space-y-5">
                    {/* Badges */}
                    <motion.div variants={fadeUp} custom={0} className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)]/20 bg-[var(--brand)]/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-dark)]">
                            <Sparkles size={12} />
                            {dashboardRole === 'admin' ? 'Admin Studio' : 'Creator Studio'}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {plan || 'FREE'} plan
                        </span>
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        variants={fadeUp}
                        custom={1}
                        className="max-w-3xl font-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl lg:text-[2.5rem] lg:leading-[1.15]"
                    >
                        Build, publish &amp; monitor — all from one place.
                    </motion.h1>
                    <motion.p
                        variants={fadeUp}
                        custom={2}
                        className="max-w-xl text-sm leading-relaxed text-slate-500 sm:text-[15px]"
                    >
                        Authoring, assessments, and learner analytics in a single workflow.
                    </motion.p>

                    {/* CTA row */}
                    <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/dashboard/creator/courses/create"
                            data-element-id="create-course-btn"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(26,86,219,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(26,86,219,0.3)]"
                        >
                            <Plus size={15} />
                            Create course
                        </Link>
                        <Link
                            href="/dashboard/creator/exams/new"
                            data-element-id="create-exam-btn"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-colors duration-200 hover:bg-white"
                        >
                            <ClipboardList size={15} />
                            Create exam
                        </Link>
                        {hasOrg && (
                            <Link
                                href="/dashboard/creator/certificates/create"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-5 py-3 text-sm font-semibold text-amber-800 backdrop-blur-sm transition-colors duration-200 hover:bg-amber-100/80"
                            >
                                <Award size={15} />
                                Create certificate
                            </Link>
                        )}
                    </motion.div>
                </div>
            </motion.section>

            {/* ═══════════════ STAT CARDS ═══════════════ */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="grid grid-cols-2 gap-3 lg:grid-cols-4"
                data-element-id="creator-stats"
            >
                {statCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        variants={scaleIn}
                        custom={i}
                        className="glass-card group cursor-default rounded-2xl p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
                    >
                        <div className="flex items-center justify-between">
                            <div
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} ${card.iconColor}`}
                            >
                                {card.icon}
                            </div>
                            <span className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {card.hint}
                            </span>
                        </div>
                        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {card.label}
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                            {card.value}
                        </p>
                    </motion.div>
                ))}
            </motion.div>

            {/* ═══════════════ CAPACITY STRIP ═══════════════ */}
            <CapacityPanel
                coursesUsed={coursesUsed}
                coursesLimit={coursesLimit}
                coursesPercent={coursesPercent}
                storageUsed={storageUsed}
                storageLimit={storageLimit}
                storagePercent={storagePercent}
                highestCapacityPercent={highestCapacityPercent}
                hasHardLimitBreach={hasHardLimitBreach}
                nextPlan={nextPlan}
            />

            {/* ═══════════════ UPGRADE BANNER ═══════════════ */}
            {highestCapacityPercent >= 80 && !hasHardLimitBreach && showUpgradeBanner && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-start gap-3">
                        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                            <AlertTriangle size={16} />
                        </div>
                        <p className="text-sm leading-6 text-amber-900">
                            Usage is near quota limits. Upgrade to {nextPlan} to avoid publishing interruptions.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowUpgradeBanner(false)}
                            className="cursor-pointer rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900 transition-colors hover:bg-amber-50"
                        >
                            Dismiss
                        </button>
                        <Link
                            href="/dashboard/creator/billing"
                            onClick={() =>
                                posthog.capture('plan_upgrade_clicked', {
                                    source: 'studio_dashboard_banner',
                                    targetPlan: nextPlan,
                                })
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-amber-600"
                        >
                            Upgrade
                            <ArrowUpRight size={13} />
                        </Link>
                    </div>
                </motion.div>
            )}

            {/* ═══════════════ PIPELINE + SIDEBAR ═══════════════ */}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                {/* Content Pipeline */}
                <motion.section
                    data-element-id="creator-content-pipeline"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.45 }}
                    className="glass-card rounded-2xl p-5 shadow-sm lg:rounded-3xl lg:p-6"
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Pipeline
                            </p>
                            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                                Manage content from draft to launch.
                            </h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Tab pills */}
                            <div className="inline-flex rounded-full bg-slate-100/80 p-1">
                                {(['Published', 'Draft'] as const).map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setTab(status)}
                                        className={`relative cursor-pointer rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${tab === status ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <label className="relative block">
                                <span className="sr-only">Search courses</span>
                                <Search
                                    size={15}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search courses"
                                    className="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50/60 px-9 py-2.5 text-sm text-slate-700 outline-none backdrop-blur-sm transition-colors duration-200 placeholder:text-slate-400 sm:w-60"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Module list */}
                    <div className="mt-5 space-y-2.5">
                        {modules.length > 0 ? (
                            modules
                                .slice(0, 6)
                                .map((module, i) => <ModuleRow key={module.id} module={module} index={i} />)
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center sm:p-10">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                    <BookOpen size={20} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-900">
                                    No {tab.toLowerCase()} courses here yet.
                                </h3>
                                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                                    Create a new course or clear your query to reveal more content.
                                </p>
                                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                                    <Link
                                        href="/dashboard/creator/courses/create"
                                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white"
                                    >
                                        <Plus size={14} />
                                        New course
                                    </Link>
                                    {searchQuery ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                                        >
                                            Clear search
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.section>

                {/* Sidebar panels */}
                <div className="space-y-5" data-element-id="creator-recent-activity">
                    {/* Studio Pulse */}
                    <motion.section
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="glass-card rounded-2xl p-5 shadow-sm"
                    >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Studio pulse
                        </p>
                        <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950">Priority signals</h2>
                        <div className="mt-4 space-y-2.5">
                            <InsightTile
                                icon={<BarChart3 size={15} />}
                                iconBg="bg-violet-50"
                                iconColor="text-violet-600"
                                title="Submission watch"
                                body={`${recentActivity.length} recent learner activity items visible.`}
                            />
                            <InsightTile
                                icon={<ShieldCheck size={15} />}
                                iconBg="bg-emerald-50"
                                iconColor="text-emerald-600"
                                title="Publishing guardrails"
                                body={`${coursesLimit > 0 || storageLimit > 0 ? 'Plan usage tracked before limits become blockers.' : 'Usage guardrails appear once limits are configured.'}`}
                            />
                            <InsightTile
                                icon={<TrendingUp size={15} />}
                                iconBg="bg-sky-50"
                                iconColor="text-sky-600"
                                title="Growth posture"
                                body={`${Number(statsRecord.totalSubmissions || 0)} total submissions processed.`}
                            />
                        </div>
                    </motion.section>

                    {/* Recent Activity */}
                    <StudioRecentActivity activities={recentActivity} />
                </div>
            </div>

            {/* ═══════════════ CHECKLIST + ANALYTICS ═══════════════ */}
            <motion.section
                data-element-id="creator-workflow"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.45 }}
                className="glass-card rounded-2xl p-5 shadow-sm lg:rounded-3xl lg:p-6"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Workflow</p>
                        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                            Ship learning experiences faster.
                        </h2>
                    </div>
                    <Link
                        href="/dashboard/creator/analytics"
                        className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-colors hover:bg-white"
                    >
                        Open analytics
                        <ArrowUpRight size={14} />
                    </Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ChecklistCard
                        icon={<BookOpen size={18} />}
                        title="Structure curriculum"
                        body="Create course hierarchy and define completion conditions."
                        accentColor="border-l-blue-400"
                    />
                    <ChecklistCard
                        icon={<ClipboardList size={18} />}
                        title="Secure assessment"
                        body="Configure exam schedules, access controls, and monitoring."
                        accentColor="border-l-indigo-400"
                    />
                    <ChecklistCard
                        icon={<Award size={18} />}
                        title="Validate outcomes"
                        body="Issue certificates and track pass/fail completion signals."
                        accentColor="border-l-amber-400"
                    />
                </div>
            </motion.section>

            {/* ═══════════════ HARD LIMIT MODAL ═══════════════ */}
            {hasHardLimitBreach && (
                <AppModal
                    isOpen={hasHardLimitBreach}
                    onClose={() => setShowUpgradeBanner(false)}
                    size="sm"
                    zIndexClass="z-[2100]"
                    showCloseButton={false}
                    bodyClassName="p-5 sm:p-6"
                    closeOnBackdrop={false}
                    ariaLabel="Plan limit reached"
                >
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                        <div className="flex items-start gap-4">
                            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">
                                    Action required
                                </p>
                                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                                    Plan limit reached
                                </h3>
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                    Your organization crossed a quota boundary. Upgrade to {nextPlan} to continue
                                    publishing without interruption.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 backdrop-blur-sm">
                            <p className="text-sm text-slate-600">
                                Current plan: <span className="font-semibold text-slate-950">{plan}</span>
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                                Recommended: <span className="font-semibold text-[var(--brand)]">{nextPlan}</span>
                            </p>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <Link
                                href="/dashboard/creator/billing"
                                onClick={() =>
                                    posthog.capture('plan_upgrade_clicked', {
                                        source: 'studio_dashboard_hard_limit',
                                        targetPlan: nextPlan,
                                    })
                                }
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
                            >
                                Upgrade now
                                <ArrowUpRight size={15} />
                            </Link>
                        </div>
                    </motion.div>
                </AppModal>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function CapacityPanel({
    coursesUsed,
    coursesLimit,
    coursesPercent,
    storageUsed,
    storageLimit,
    storagePercent,
    highestCapacityPercent,
    hasHardLimitBreach,
    nextPlan,
}: {
    coursesUsed: number;
    coursesLimit: number;
    coursesPercent: number;
    storageUsed: number;
    storageLimit: number;
    storagePercent: number;
    highestCapacityPercent: number;
    hasHardLimitBreach: boolean;
    nextPlan: string;
}) {
    return (
        <motion.div
            data-element-id="creator-capacity"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950/95 p-5 text-white shadow-[0_12px_36px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:rounded-3xl"
        >
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[var(--brand)]/[0.08] blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Capacity
                            </p>
                            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                                {highestCapacityPercent >= 80 ? 'Needs attention' : 'Healthy usage'}
                            </h2>
                        </div>
                        <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                            {highestCapacityPercent}% used
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <UsageMeter
                            label="Course capacity"
                            used={coursesUsed}
                            limit={coursesLimit}
                            percent={coursesPercent}
                            suffix="courses"
                        />
                        <UsageMeter
                            label="Storage capacity"
                            used={storageUsed}
                            limit={storageLimit}
                            percent={storagePercent}
                            suffix="MB"
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 lg:w-64">
                    <p className="text-sm font-semibold text-white">Publishing runway</p>
                    <p className="mt-1 text-xs leading-6 text-slate-300">
                        {hasHardLimitBreach
                            ? `Upgrade to ${nextPlan} to keep creation available.`
                            : highestCapacityPercent >= 80
                              ? `Usage rising. Move to ${nextPlan} soon.`
                              : 'Enough headroom for active operations.'}
                    </p>
                    <Link
                        href="/dashboard/creator/billing"
                        onClick={() =>
                            posthog.capture('plan_upgrade_clicked', {
                                source: 'studio_dashboard_hero',
                                targetPlan: nextPlan,
                            })
                        }
                        className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition-colors hover:bg-slate-100"
                    >
                        Review plan
                        <ArrowUpRight size={13} />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}

function UsageMeter({
    label,
    used,
    limit,
    percent,
    suffix,
}: {
    label: string;
    used: number;
    limit: number;
    percent: number;
    suffix: string;
}) {
    const limitLabel = limit > 0 ? `${limit} ${suffix}` : 'No cap';
    const valueLabel = `${used} ${suffix}`;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-300">
                <span>{label}</span>
                <span>
                    {valueLabel} / {limitLabel}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${limit > 0 ? percent : 18}%` }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400"
                />
            </div>
        </div>
    );
}

function ModuleRow({ module, index }: { module: StudioModule; index: number }) {
    const status = module.status || 'Draft';
    const studentCount = Number(module.students || 0);
    const unitCount = Number(module.modules || 0);
    const lastUpdated = formatTimestamp(module.lastUpdated);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
            className={`group rounded-xl border border-slate-200/80 bg-white/60 p-4 backdrop-blur-sm transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-sm ${
                status === 'Published' ? 'border-l-[3px] border-l-emerald-400' : 'border-l-[3px] border-l-slate-300'
            }`}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-950">
                            {module.title || 'Untitled course'}
                        </h3>
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {status}
                        </span>
                        {module.linkedExamId ? (
                            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
                                Exam linked
                            </span>
                        ) : null}
                        {module.certificateTemplateId ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                Certificate
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{studentCount} learners</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{unitCount} units</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>Updated {lastUpdated}</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/dashboard/creator/courses/${module.id}/edit`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                        Edit course
                    </Link>
                    <Link
                        href={
                            module.linkedExamId
                                ? `/dashboard/creator/exams/${module.linkedExamId}/edit`
                                : '/dashboard/creator/exams/new'
                        }
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                        {module.linkedExamId ? 'Open exam' : 'Add exam'}
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}

function InsightTile({
    icon,
    iconBg,
    iconColor,
    title,
    body,
}: {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    title: string;
    body: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 transition-colors duration-200 hover:bg-white">
            <div className="flex items-start gap-3">
                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{body}</p>
                </div>
            </div>
        </div>
    );
}

function ChecklistCard({
    icon,
    title,
    body,
    accentColor,
}: {
    icon: React.ReactNode;
    title: string;
    body: string;
    accentColor: string;
}) {
    return (
        <div
            className={`rounded-xl border border-slate-200/70 border-l-[3px] ${accentColor} bg-slate-50/60 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm`}
        >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-900 shadow-sm">
                {icon}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{body}</p>
        </div>
    );
}

function formatTimestamp(value?: string) {
    if (!value) return 'recently';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'recently';
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
