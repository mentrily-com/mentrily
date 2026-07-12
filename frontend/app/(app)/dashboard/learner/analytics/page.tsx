'use client';
import React, { useState, useMemo, useEffect } from 'react';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { useSearchParams, useRouter } from 'next/navigation';
import { StudentService } from '@/services/api/StudentService';
import {
    BookOpenCheck,
    Zap,
    Target,
    Sparkles,
    Repeat,
    Flame,
    Code2,
    Globe,
    ListChecks,
    BookOpen,
    NotebookPen,
    Layers,
    TrendingUp,
    GraduationCap,
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
} from 'recharts';

interface Attempt {
    id: string;
    date: string;
    dateMs: number;
    testCases: string;
    status: 'success' | 'failed';
}

interface Question {
    id: number;
    unitId: string;
    title: string;
    course: string;
    type: string;
    status: string;
    attempts: Attempt[];
}

// Status colors (validated: deutan ΔE 19.2 — passes CVD separation; the
// emerald contrast warn is relieved by printed counts + legend everywhere
// these fills appear).
const PASSED_COLOR = '#10b981';
const FAILED_COLOR = '#f43f5e';

const HEATMAP_WEEKS = 16;

const tooltipStyle: React.CSSProperties = {
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    fontSize: '11px',
    fontWeight: 700,
    background: '#ffffff',
};

const emptyAnalyticsData = {
    weeklyActivity: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({
        day,
        attempts: 0,
        passed: 0,
        failed: 0,
    })),
    courseMastery: [],
    stats: {
        totalQuestions: 0,
        totalAttempts: 0,
        passedAttempts: 0,
        successRate: 0,
        streak: 0,
    },
};

const TYPE_META: Record<string, { icon: React.ComponentType<any>; label: string }> = {
    MCQ: { icon: ListChecks, label: 'Multiple Choice' },
    MultiSelect: { icon: ListChecks, label: 'Multi Select' },
    Coding: { icon: Code2, label: 'Coding' },
    Web: { icon: Globe, label: 'Web Lab' },
    Reading: { icon: BookOpen, label: 'Reading' },
    Notebook: { icon: NotebookPen, label: 'Notebook' },
};

export default function AnalyticsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const studentNameParam = searchParams.get('studentName');
    const studentIdParam = searchParams.get('studentId');

    const [activeTab, setActiveTab] = useState<'overview' | 'attempts'>('overview');

    const handleExitTeacherView = React.useCallback(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
        }

        router.push('/dashboard/creator/users');
    }, [router]);
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const [selectedCourse, setSelectedCourse] = useState('All Courses');

    const [loading, setLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [heatCellTip, setHeatCellTip] = useState<{ x: number; y: number; text: string } | null>(null);

    useEffect(() => {
        async function loadAnalytics() {
            try {
                const studentId = studentIdParam;
                let data;
                let attemptsData;

                if (studentId) {
                    // Fetch as teacher
                    const { TeacherService } = await import('@/services/api/TeacherService');
                    const [analyticsResult, attemptsResult] = await Promise.all([
                        TeacherService.getStudentAnalytics(studentId),
                        TeacherService.getStudentUnitSubmissions(studentId),
                    ]);
                    data = analyticsResult;
                    attemptsData = attemptsResult;
                } else {
                    // Fetch as student
                    const [analyticsResult, attemptsResult] = await Promise.all([
                        StudentService.getAnalytics(),
                        StudentService.getUnitAttempts().catch(() => []),
                    ]);
                    data = analyticsResult;
                    attemptsData = attemptsResult;
                }

                setAnalyticsData(data || emptyAnalyticsData);

                // Group submissions by unitId for the detailed table
                const unitMap = new Map<string, Question>();
                attemptsData.forEach((sub: any) => {
                    const unitId = sub.unitId;
                    if (!unitMap.has(unitId)) {
                        unitMap.set(unitId, {
                            id: unitMap.size + 1,
                            unitId: unitId,
                            title: sub.unitTitle,
                            course: sub.courseTitle,
                            type: sub.unitType,
                            status: sub.status === 'COMPLETED' ? 'Submitted' : sub.status,
                            attempts: [],
                        });
                    }

                    const unit = unitMap.get(unitId)!;

                    // If any attempt is COMPLETED, mark the whole unit as Submitted
                    if (sub.status === 'COMPLETED') {
                        unit.status = 'Submitted';
                    }

                    unit.attempts.push({
                        id: sub.id,
                        date: new Date(sub.createdAt).toLocaleString(),
                        dateMs: new Date(sub.createdAt).getTime(),
                        testCases: sub.testCases || (sub.score !== null ? `${sub.score}/100` : 'N/A'),
                        status: sub.status === 'COMPLETED' ? 'success' : 'failed',
                    });
                });

                const mappedQuestions = Array.from(unitMap.values());
                setQuestions(mappedQuestions);
            } catch {
                setAnalyticsData(emptyAnalyticsData);
                setQuestions([]);
            } finally {
                setLoading(false);
            }
        }
        loadAnalytics();
    }, [studentIdParam]);

    const allAttempts = useMemo(() => questions.flatMap((q) => q.attempts), [questions]);

    const stats = useMemo(() => {
        if (!analyticsData)
            return {
                totalQuestions: 0,
                totalAttempts: 0,
                passedAttempts: 0,
                failedAttempts: 0,
                successRate: 0,
                avgAttempts: '0',
                firstTryRate: 0,
                streak: 0,
                unitsCleared: 0,
            };

        // First-try success: units whose EARLIEST attempt already passed.
        let firstTryHits = 0;
        questions.forEach((q) => {
            if (q.attempts.length === 0) return;
            const earliest = [...q.attempts].sort((a, b) => a.dateMs - b.dateMs)[0];
            if (earliest.status === 'success') firstTryHits += 1;
        });

        const unitsCleared = questions.filter((q) => q.status === 'Submitted' || q.status === 'COMPLETED').length;

        return {
            totalQuestions: analyticsData.stats.totalQuestions,
            totalAttempts: analyticsData.stats.totalAttempts,
            passedAttempts: analyticsData.stats.passedAttempts,
            failedAttempts: analyticsData.stats.totalAttempts - analyticsData.stats.passedAttempts,
            successRate: analyticsData.stats.successRate,
            avgAttempts:
                analyticsData.stats.totalQuestions > 0
                    ? (analyticsData.stats.totalAttempts / analyticsData.stats.totalQuestions).toFixed(1)
                    : '0',
            firstTryRate: questions.length > 0 ? Math.round((firstTryHits / questions.length) * 100) : 0,
            streak: analyticsData.stats.streak || 0,
            unitsCleared,
        };
    }, [analyticsData, questions]);

    // Last 14 days of activity, computed from raw attempt timestamps (falls
    // back to the backend's 7-day series when the attempts fetch failed).
    const dailySeries = useMemo(() => {
        const days: { key: string; label: string; passed: number; failed: number }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            days.push({
                key: d.toDateString(),
                label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
                passed: 0,
                failed: 0,
            });
        }

        if (allAttempts.length > 0) {
            const index = new Map(days.map((d, i) => [d.key, i]));
            allAttempts.forEach((a) => {
                const d = new Date(a.dateMs);
                d.setHours(0, 0, 0, 0);
                const idx = index.get(d.toDateString());
                if (idx === undefined) return;
                if (a.status === 'success') days[idx].passed += 1;
                else days[idx].failed += 1;
            });
            return days;
        }

        // Fallback: backend series covers the trailing 7 days.
        const weekly = analyticsData?.weeklyActivity || [];
        weekly.forEach((w: any, i: number) => {
            const idx = days.length - weekly.length + i;
            if (idx >= 0) {
                days[idx].passed = w.passed || 0;
                days[idx].failed = w.failed || 0;
            }
        });
        return days;
    }, [allAttempts, analyticsData]);

    // GitHub-style consistency heatmap: HEATMAP_WEEKS trailing weeks,
    // columns = weeks, rows = Sun..Sat.
    const heatmap = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        // Pad the final column through Saturday so the last week renders full-height.
        end.setDate(end.getDate() + (6 - end.getDay()));
        const start = new Date(end);
        start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));

        const counts = new Map<string, number>();
        allAttempts.forEach((a) => {
            const d = new Date(a.dateMs);
            d.setHours(0, 0, 0, 0);
            const key = d.toDateString();
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        let max = 0;
        counts.forEach((v) => {
            if (v > max) max = v;
        });

        const weeks: { date: Date; count: number; future: boolean }[][] = [];
        const monthLabels: { index: number; label: string }[] = [];
        const cursor = new Date(start);
        let lastMonth = -1;
        let lastLabelIndex = -10;
        for (let w = 0; w < HEATMAP_WEEKS; w++) {
            const col: { date: Date; count: number; future: boolean }[] = [];
            for (let d = 0; d < 7; d++) {
                col.push({
                    date: new Date(cursor),
                    count: counts.get(cursor.toDateString()) || 0,
                    future: cursor > today,
                });
                cursor.setDate(cursor.getDate() + 1);
            }
            const firstOfWeek = col[0].date;
            // ≥3 columns since the last label, so a partial first month
            // followed immediately by the next can't collide.
            if (firstOfWeek.getMonth() !== lastMonth && w - lastLabelIndex >= 3) {
                monthLabels.push({
                    index: w,
                    label: firstOfWeek.toLocaleDateString(undefined, { month: 'short' }),
                });
                lastLabelIndex = w;
            }
            lastMonth = firstOfWeek.getMonth();
            weeks.push(col);
        }

        // Side-rail summary stats
        let busiest: { date: Date; count: number } | null = null;
        weeks.flat().forEach((c) => {
            if (!c.future && c.count > 0 && (!busiest || c.count > busiest.count)) {
                busiest = { date: c.date, count: c.count };
            }
        });
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - today.getDay());
        let thisWeek = 0;
        counts.forEach((v, k) => {
            const d = new Date(k);
            if (d >= weekStart) thisWeek += v;
        });

        const activeDays = counts.size;
        return { weeks, monthLabels, max, activeDays, busiest: busiest as { date: Date; count: number } | null, thisWeek };
    }, [allAttempts]);

    // Sequential brand ramp for the heatmap: one hue, light -> dark.
    const heatColor = (count: number, max: number) => {
        if (count === 0) return '#f1f5f9';
        const level = max <= 1 ? 4 : Math.min(4, Math.ceil((count / max) * 4));
        const mix = [30, 55, 78, 100][level - 1];
        return `color-mix(in srgb, var(--brand) ${mix}%, white)`;
    };

    // Per-course progress, computed from real per-unit outcomes (falls back
    // to the backend's courseMastery when attempts data is unavailable).
    const courseProgress = useMemo(() => {
        if (questions.length > 0) {
            const byCourse = new Map<string, { attempted: number; completed: number; attempts: number }>();
            questions.forEach((q) => {
                const entry = byCourse.get(q.course) || { attempted: 0, completed: 0, attempts: 0 };
                entry.attempted += 1;
                entry.attempts += q.attempts.length;
                if (q.status === 'Submitted' || q.status === 'COMPLETED') entry.completed += 1;
                byCourse.set(q.course, entry);
            });
            return Array.from(byCourse.entries())
                .map(([name, v]) => ({
                    name,
                    pct: v.attempted > 0 ? Math.round((v.completed / v.attempted) * 100) : 0,
                    ...v,
                }))
                .sort((a, b) => b.pct - a.pct);
        }

        return (analyticsData?.courseMastery || []).map((c: any) => ({
            name: c.subject,
            pct: Math.round(((c.A || 0) / (c.fullMark || 150)) * 100),
            attempted: null,
            completed: null,
            attempts: null,
        }));
    }, [questions, analyticsData]);

    const typeBreakdown = useMemo(() => {
        const byType = new Map<string, { units: number; completed: number }>();
        questions.forEach((q) => {
            const entry = byType.get(q.type) || { units: 0, completed: 0 };
            entry.units += 1;
            if (q.status === 'Submitted' || q.status === 'COMPLETED') entry.completed += 1;
            byType.set(q.type, entry);
        });
        return Array.from(byType.entries())
            .map(([type, v]) => ({
                type,
                pct: v.units > 0 ? Math.round((v.completed / v.units) * 100) : 0,
                ...v,
            }))
            .sort((a, b) => b.units - a.units);
    }, [questions]);

    const availableCourses = useMemo(() => {
        const courses = new Set(questions.map((q) => q.course));
        return ['All Courses', ...Array.from(courses)];
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        return questions.filter((q) => selectedCourse === 'All Courses' || q.course === selectedCourse);
    }, [questions, selectedCourse]);

    const outcomePieData = [
        { name: 'Passed', value: stats.passedAttempts },
        { name: 'Failed', value: stats.failedAttempts },
    ];
    const hasOutcomes = stats.totalAttempts > 0;
    const hasAnyData = stats.totalAttempts > 0 || questions.length > 0;

    const toggleExpand = (id: number) => {
        setExpandedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-[var(--brand-light)]">
                <DashboardSkeleton type="main" userRole={studentNameParam ? 'teacher' : 'student'} noNavbar />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-[var(--brand-light)]">
            {/* TEACHER VIEW BANNER */}
            {studentNameParam && (
                <div className="bg-[var(--brand)] text-white px-4 sm:px-6 py-3 sticky top-[56px] sm:top-[73px] z-40 shadow-md flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            >
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </div>
                        <span className="font-bold text-sm tracking-wide">
                            Viewing Analytics for{' '}
                            <span className="font-black text-white px-1">{decodeURIComponent(studentNameParam)}</span>
                        </span>
                    </div>
                    <button
                        onClick={handleExitTeacherView}
                        className="w-full px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black uppercase tracking-widest transition-all sm:w-auto"
                    >
                        Exit Teacher View
                    </button>
                </div>
            )}

            {/* COMPACT STICKY SUB-HEADER */}
            <div className="sticky top-[56px] sm:top-[61px] z-40 bg-white border-b border-slate-200/60 shadow-sm transition-all duration-300">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">
                            Performance Analytics
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400">
                            Tracking progress across all coding modules
                        </p>
                    </div>

                    <div className="flex items-center overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-black uppercase tracking-widest transition-all relative group whitespace-nowrap ${activeTab === 'overview' ? 'text-[var(--brand)]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span className="relative z-10">Overview</span>
                            {activeTab === 'overview' && (
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-[var(--brand)] rounded-t-full" />
                            )}
                            <div className="absolute inset-x-2 inset-y-2 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl -z-0" />
                        </button>
                        <button
                            onClick={() => setActiveTab('attempts')}
                            className={`px-4 sm:px-6 py-3 sm:py-4 text-[11px] font-black uppercase tracking-widest transition-all relative group whitespace-nowrap ${activeTab === 'attempts' ? 'text-[var(--brand)]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span className="relative z-10">Detailed Attempts</span>
                            {activeTab === 'attempts' && (
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-[var(--brand)] rounded-t-full" />
                            )}
                            <div className="absolute inset-x-2 inset-y-2 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl -z-0" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
                {activeTab === 'overview' ? (
                    !hasAnyData ? (
                        <EmptyState isTeacherView={!!studentNameParam} />
                    ) : (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            {/* STAT TILES */}
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                                <StatTile
                                    icon={BookOpenCheck}
                                    label="Questions"
                                    value={stats.totalQuestions}
                                    sub={`${stats.unitsCleared} cleared`}
                                    tone="brand"
                                />
                                <StatTile
                                    icon={Zap}
                                    label="Attempts"
                                    value={stats.totalAttempts}
                                    sub={`${stats.passedAttempts} passed`}
                                    tone="brand"
                                />
                                <StatTile
                                    icon={Target}
                                    label="Success Rate"
                                    value={`${stats.successRate}%`}
                                    sub="of all attempts"
                                    tone={stats.successRate >= 60 ? 'emerald' : stats.successRate >= 30 ? 'amber' : 'rose'}
                                />
                                <StatTile
                                    icon={Sparkles}
                                    label="First Try"
                                    value={`${stats.firstTryRate}%`}
                                    sub="solved on attempt #1"
                                    tone="emerald"
                                />
                                <StatTile
                                    icon={Repeat}
                                    label="Avg Attempts"
                                    value={stats.avgAttempts}
                                    sub="per question"
                                    tone="slate"
                                />
                                <StatTile
                                    icon={Flame}
                                    label="Day Streak"
                                    value={stats.streak}
                                    sub={stats.streak > 0 ? 'keep it going!' : 'practice today'}
                                    tone={stats.streak > 0 ? 'amber' : 'slate'}
                                />
                            </div>

                            {/* CONSISTENCY HEATMAP */}
                            <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
                                    <div>
                                        <h3 className="text-base font-black text-slate-800">Practice Consistency</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            Last {HEATMAP_WEEKS} weeks · {heatmap.activeDays} active day
                                            {heatmap.activeDays === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {stats.streak > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                                <Flame size={12} />
                                                {stats.streak} day streak
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Less</span>
                                            {[0, 1, 2, 3, 4].map((lvl) => (
                                                <div
                                                    key={lvl}
                                                    className="w-3 h-3 rounded-[3px]"
                                                    style={{
                                                        backgroundColor:
                                                            lvl === 0
                                                                ? '#f1f5f9'
                                                                : `color-mix(in srgb, var(--brand) ${[30, 55, 78, 100][lvl - 1]}%, white)`,
                                                    }}
                                                />
                                            ))}
                                            <span className="text-[9px] font-black text-slate-400 uppercase">More</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="overflow-x-auto no-scrollbar">
                                        <div className="min-w-max">
                                            {/* Month labels */}
                                            <div className="relative h-4 mb-1 ml-9">
                                                {heatmap.monthLabels.map((m) => (
                                                    <span
                                                        key={`${m.label}-${m.index}`}
                                                        className="absolute text-[9px] font-black text-slate-400 uppercase"
                                                        style={{ left: `${m.index * 20}px` }}
                                                    >
                                                        {m.label}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex gap-1">
                                                {/* Day labels */}
                                                <div className="flex flex-col gap-1 w-8 shrink-0 justify-between pr-1">
                                                    {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                                                        <span
                                                            key={i}
                                                            className="h-4 text-[8px] font-black text-slate-400 uppercase leading-4"
                                                        >
                                                            {d}
                                                        </span>
                                                    ))}
                                                </div>
                                                {heatmap.weeks.map((week, wi) => (
                                                    <div key={wi} className="flex flex-col gap-1">
                                                        {week.map((cell, di) => (
                                                            <div
                                                                key={di}
                                                                className="w-4 h-4 rounded-[4px] transition-transform hover:scale-125 hover:ring-2 hover:ring-slate-300"
                                                                style={{
                                                                    backgroundColor: cell.future
                                                                        ? 'transparent'
                                                                        : heatColor(cell.count, heatmap.max),
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (cell.future) return;
                                                                    const rect = (
                                                                        e.target as HTMLElement
                                                                    ).getBoundingClientRect();
                                                                    setHeatCellTip({
                                                                        x: rect.left + rect.width / 2,
                                                                        y: rect.top,
                                                                        text: `${cell.count} attempt${cell.count === 1 ? '' : 's'} · ${cell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
                                                                    });
                                                                }}
                                                                onMouseLeave={() => setHeatCellTip(null)}
                                                            />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary rail */}
                                    <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:w-56 lg:border-l lg:border-slate-100 lg:pl-8 shrink-0">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                This week
                                            </p>
                                            <p className="text-lg font-black text-slate-800 leading-none">
                                                {heatmap.thisWeek}
                                                <span className="text-[10px] font-bold text-slate-400 ml-1.5">
                                                    attempts
                                                </span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                Active days
                                            </p>
                                            <p className="text-lg font-black text-slate-800 leading-none">
                                                {heatmap.activeDays}
                                                <span className="text-[10px] font-bold text-slate-400 ml-1.5">
                                                    total
                                                </span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                Busiest day
                                            </p>
                                            <p className="text-lg font-black text-slate-800 leading-none">
                                                {heatmap.busiest
                                                    ? heatmap.busiest.date.toLocaleDateString(undefined, {
                                                          month: 'short',
                                                          day: 'numeric',
                                                      })
                                                    : '—'}
                                                {heatmap.busiest && (
                                                    <span className="text-[10px] font-bold text-slate-400 ml-1.5">
                                                        {heatmap.busiest.count} attempts
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {heatCellTip && (
                                    <div
                                        className="fixed z-[60] px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold pointer-events-none -translate-x-1/2 -translate-y-full whitespace-nowrap shadow-xl"
                                        style={{ left: heatCellTip.x, top: heatCellTip.y - 6 }}
                                    >
                                        {heatCellTip.text}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* DAILY ACTIVITY — stacked bars, last 14 days */}
                                <div className="lg:col-span-2 bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                                        <div>
                                            <h3 className="text-base font-black text-slate-800">Daily Activity</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Submissions over the last 14 days
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-[3px]"
                                                    style={{ backgroundColor: PASSED_COLOR }}
                                                />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Passed
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-[3px]"
                                                    style={{ backgroundColor: FAILED_COLOR }}
                                                />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    Failed
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-[280px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dailySeries} barCategoryGap="28%">
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    vertical={false}
                                                    stroke="#f1f5f9"
                                                />
                                                <XAxis
                                                    dataKey="label"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }}
                                                    dy={8}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    allowDecimals={false}
                                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                                    width={28}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={tooltipStyle}
                                                    formatter={(value: any, name: any) => [
                                                        value,
                                                        name === 'passed' ? 'Passed' : 'Failed',
                                                    ]}
                                                />
                                                <Bar
                                                    dataKey="passed"
                                                    stackId="a"
                                                    fill={PASSED_COLOR}
                                                    stroke="#ffffff"
                                                    strokeWidth={1}
                                                    maxBarSize={26}
                                                />
                                                <Bar
                                                    dataKey="failed"
                                                    stackId="a"
                                                    fill={FAILED_COLOR}
                                                    stroke="#ffffff"
                                                    strokeWidth={1}
                                                    radius={[4, 4, 0, 0]}
                                                    maxBarSize={26}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* OUTCOME DONUT */}
                                <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7 flex flex-col">
                                    <h3 className="text-base font-black text-slate-800">Outcomes</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 mb-4">
                                        All submissions
                                    </p>
                                    <div className="h-[200px] w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={
                                                        hasOutcomes
                                                            ? outcomePieData.filter((d) => d.value > 0)
                                                            : [{ name: 'No data', value: 1 }]
                                                    }
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={62}
                                                    outerRadius={80}
                                                    paddingAngle={hasOutcomes ? 3 : 0}
                                                    dataKey="value"
                                                    stroke="#ffffff"
                                                    strokeWidth={2}
                                                >
                                                    {hasOutcomes ? (
                                                        outcomePieData
                                                            .filter((d) => d.value > 0)
                                                            .map((entry) => (
                                                                <Cell
                                                                    key={entry.name}
                                                                    fill={
                                                                        entry.name === 'Passed'
                                                                            ? PASSED_COLOR
                                                                            : FAILED_COLOR
                                                                    }
                                                                />
                                                            ))
                                                    ) : (
                                                        <Cell fill="#e2e8f0" />
                                                    )}
                                                </Pie>
                                                {hasOutcomes && <Tooltip contentStyle={tooltipStyle} />}
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-3xl font-black text-slate-800 leading-none">
                                                {stats.successRate}%
                                            </span>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                                                Success rate
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-5 space-y-2.5">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2.5">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-[3px]"
                                                    style={{ backgroundColor: PASSED_COLOR }}
                                                />
                                                <span className="text-xs font-bold text-slate-600">Passed</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-800">
                                                {stats.passedAttempts}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2.5">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-[3px]"
                                                    style={{ backgroundColor: FAILED_COLOR }}
                                                />
                                                <span className="text-xs font-bold text-slate-600">Failed</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-800">
                                                {stats.failedAttempts}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between px-1 pt-2.5 border-t border-slate-100">
                                            <div className="flex items-center gap-2.5">
                                                <Sparkles size={12} className="text-slate-400" />
                                                <span className="text-xs font-bold text-slate-600">
                                                    First-try solves
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-slate-800">
                                                {stats.firstTryRate}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* COURSE PROGRESS */}
                                <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <GraduationCap size={16} className="text-[var(--brand)]" />
                                        <h3 className="text-base font-black text-slate-800">Course Progress</h3>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                                        Questions cleared per enrolled course
                                    </p>
                                    {courseProgress.length > 0 ? (
                                        <div className="space-y-5">
                                            {courseProgress.map((course: any) => (
                                                <div key={course.name}>
                                                    <div className="flex items-baseline justify-between mb-1.5 gap-3">
                                                        <span className="text-xs font-black text-slate-700 truncate">
                                                            {course.name}
                                                        </span>
                                                        <span className="text-[10px] font-black text-slate-400 shrink-0">
                                                            {course.completed !== null
                                                                ? `${course.completed}/${course.attempted} · ${course.pct}%`
                                                                : `${course.pct}%`}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-[var(--brand)] transition-all duration-700"
                                                            style={{ width: `${course.pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-10 text-center">
                                            <p className="text-xs font-bold text-slate-400">
                                                Start a course to track your progress here.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* QUESTION TYPES */}
                                <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 sm:p-7">
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <TrendingUp size={16} className="text-[var(--brand)]" />
                                        <h3 className="text-base font-black text-slate-800">By Question Type</h3>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                                        Where you're strongest
                                    </p>
                                    {typeBreakdown.length > 0 ? (
                                        <div className="space-y-3">
                                            {typeBreakdown.map((t) => {
                                                const meta = TYPE_META[t.type] || { icon: Layers, label: t.type };
                                                const Icon = meta.icon;
                                                return (
                                                    <div
                                                        key={t.type}
                                                        className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                                                    >
                                                        <div className="w-9 h-9 rounded-lg bg-[var(--brand-lighter)] text-[var(--brand)] flex items-center justify-center shrink-0">
                                                            <Icon size={16} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                                                <span className="text-xs font-black text-slate-700">
                                                                    {meta.label}
                                                                </span>
                                                                <span className="text-[10px] font-black text-slate-400 shrink-0">
                                                                    {t.completed}/{t.units} cleared
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-700"
                                                                    style={{
                                                                        width: `${t.pct}%`,
                                                                        backgroundColor:
                                                                            t.pct >= 60
                                                                                ? PASSED_COLOR
                                                                                : t.pct >= 30
                                                                                  ? '#f59e0b'
                                                                                  : FAILED_COLOR,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <span className="text-sm font-black text-slate-800 w-11 text-right shrink-0">
                                                            {t.pct}%
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-10 text-center">
                                            <p className="text-xs font-bold text-slate-400">
                                                Attempt questions to see your strengths by type.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Filter Section */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                                <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                                    Filter Course
                                </span>
                                <div className="relative w-full sm:w-auto">
                                    <select
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                        className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-5 py-2.5 pr-12 text-xs font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-[var(--brand-light)] transition-all cursor-pointer shadow-sm"
                                    >
                                        {availableCourses.map((course) => (
                                            <option key={course} value={course}>
                                                {course}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                        >
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <div className="relative w-full md:w-96">
                                <input
                                    type="text"
                                    placeholder="Search assessment results..."
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-6 text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/5 transition-all shadow-sm"
                                />
                                <svg
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                            </div>
                        </div>

                        {/* Detailed Table */}
                        <div className="bg-white border border-slate-100 rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-sm">
                            <div className="hidden items-center px-10 py-5 bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 md:flex">
                                <div className="flex-1">Questions</div>
                                <div className="w-40 text-center">Category</div>
                                <div className="w-40 text-right mr-10">Latest Status</div>
                            </div>

                            <div className="divide-y divide-slate-50">
                                {filteredQuestions.map((q) => (
                                    <div key={q.id} className="bg-white">
                                        <div
                                            onClick={() => toggleExpand(q.id)}
                                            className={`flex flex-col gap-3 px-4 py-5 hover:bg-slate-50/30 cursor-pointer transition-all duration-300 group md:flex-row md:items-center md:px-10 md:py-6 ${expandedIds.includes(q.id) ? 'bg-slate-50/20' : ''}`}
                                        >
                                            <div className="flex-1 flex min-w-0 items-center gap-4 md:gap-6">
                                                <span
                                                    className={`text-[12px] font-black w-6 transition-colors ${expandedIds.includes(q.id) ? 'text-[var(--brand)]' : 'text-slate-300'}`}
                                                >
                                                    {q.id}.
                                                </span>
                                                <div className="min-w-0">
                                                    <span className="text-sm font-black text-slate-800 group-hover:text-[var(--brand)] transition-colors">
                                                        {q.title}
                                                    </span>
                                                    <div className="flex gap-2 mt-1">
                                                        {q.attempts.length > 0 && (
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                {q.attempts.length} attempts
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-fit md:w-40 text-left md:text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg inline-block md:self-center md:mx-auto">
                                                {q.type}
                                            </div>
                                            <div className="w-full md:w-40 flex items-center justify-between md:justify-end gap-3 text-right md:mr-10">
                                                <span
                                                    className={`text-[11px] font-black px-3 py-1 rounded-lg ${q.status === 'Submitted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}
                                                >
                                                    {q.status}
                                                </span>
                                                <div
                                                    className={`p-2 rounded-xl transition-all ${expandedIds.includes(q.id) ? 'rotate-180 bg-[var(--brand-light)] text-[var(--brand)]' : 'text-slate-300'}`}
                                                >
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="3"
                                                    >
                                                        <path d="M6 9l6 6 6-6" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        {expandedIds.includes(q.id) && (
                                            <div className="px-4 pb-6 pt-4 bg-slate-50/10 sm:px-10 sm:pb-10">
                                                {q.attempts.length > 0 ? (
                                                    <div className="max-w-4xl mx-auto space-y-4">
                                                        <div className="flex flex-wrap items-center justify-center gap-3 mb-6 sm:gap-8">
                                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />{' '}
                                                                Success:{' '}
                                                                {
                                                                    q.attempts.filter(
                                                                        (a: Attempt) => a.status === 'success',
                                                                    ).length
                                                                }
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                                                <div className="w-2 h-2 rounded-full bg-rose-500" />{' '}
                                                                Failed:{' '}
                                                                {
                                                                    q.attempts.filter(
                                                                        (a: Attempt) => a.status === 'failed',
                                                                    ).length
                                                                }
                                                            </div>
                                                        </div>

                                                        <div className="border border-slate-100 rounded-[24px] bg-white overflow-hidden shadow-sm">
                                                            <div className="hidden grid-cols-3 px-8 py-3 bg-slate-50/50 border-b border-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center sm:grid">
                                                                <div>Date & Time</div>
                                                                <div>Test Cases</div>
                                                                <div>Outcome</div>
                                                            </div>
                                                            <div className="divide-y divide-slate-50">
                                                                {q.attempts.map((attempt: Attempt, idx: number) => {
                                                                    const isTeacherView =
                                                                        !!searchParams.get('studentId');
                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (!isTeacherView) {
                                                                                    router.push(
                                                                                        `/dashboard/learner/unit/${q.unitId}?attemptId=${attempt.id}`,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            className={`grid grid-cols-1 gap-2 px-4 py-4 text-[11px] font-bold text-slate-600 transition-colors sm:grid-cols-3 sm:px-8 sm:text-center ${!isTeacherView ? 'cursor-pointer hover:bg-slate-50/50' : ''}`}
                                                                        >
                                                                            <div className="font-mono text-slate-400">
                                                                                {attempt.date}
                                                                            </div>
                                                                            <div className="text-slate-800">
                                                                                {attempt.testCases}
                                                                            </div>
                                                                            <div>
                                                                                <span
                                                                                    className={`px-3 py-1 rounded-lg text-[10px] uppercase font-black tracking-widest ${attempt.status === 'success' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' : 'bg-rose-50 text-rose-500 border border-rose-100'}`}
                                                                                >
                                                                                    {attempt.status}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-12 rounded-[24px] bg-white border-2 border-dashed border-slate-100 flex flex-col items-center">
                                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl mb-4 text-slate-300">
                                                            ∅
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-400 italic">
                                                            No attempt logs found for this specific assessment.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {questions.length === 0 && (
                                    <div className="px-10 py-10 text-center text-slate-500 font-bold uppercase tracking-widest text-[11px]">
                                        No assessment history found
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function EmptyState({ isTeacherView }: { isTeacherView: boolean }) {
    const router = useRouter();
    return (
        <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm px-6 py-16 sm:py-24 flex flex-col items-center text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand-lighter)] text-[var(--brand)] flex items-center justify-center mb-6">
                <TrendingUp size={28} />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">
                {isTeacherView ? 'No activity yet' : 'Your analytics start here'}
            </h2>
            <p className="text-sm font-medium text-slate-500 max-w-md leading-relaxed mb-8">
                {isTeacherView
                    ? "This student hasn't attempted any questions yet. Their progress, consistency, and strengths will appear here once they start practicing."
                    : 'Attempt your first question and this page comes alive — daily activity, practice streaks, success rates, and course-by-course strengths.'}
            </p>
            {!isTeacherView && (
                <button
                    onClick={() => router.push('/dashboard/learner')}
                    className="px-8 py-3 rounded-xl bg-[var(--brand)] text-white text-xs font-black uppercase tracking-widest hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-[var(--brand-light)]"
                >
                    Browse Courses
                </button>
            )}
        </div>
    );
}

function StatTile({
    icon: Icon,
    label,
    value,
    sub,
    tone,
}: {
    icon: React.ComponentType<any>;
    label: string;
    value: string | number;
    sub: string;
    tone: 'brand' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
    const toneClasses: Record<string, string> = {
        brand: 'bg-[var(--brand-lighter)] text-[var(--brand)]',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
        slate: 'bg-slate-100 text-slate-500',
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 hover:border-[var(--brand-light)] hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${toneClasses[tone]}`}
                >
                    <Icon size={14} />
                </div>
            </div>
            <p className="text-2xl font-black text-slate-900 leading-none tracking-tight">{value}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1.5 truncate">{sub}</p>
        </div>
    );
}
