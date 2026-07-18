'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PlanGate from '@/app/components/Common/PlanGate';
import DashboardSkeleton from '@/app/components/Skeletons/DashboardSkeleton';
import { usePlan } from '@/hooks/usePlan';
import { useApolloClient } from '@apollo/client/react';
import { useQuery } from '@tanstack/react-query';
import { AuthService } from '@/services/api/AuthService';
import { AdminService } from '@/services/api/AdminService';
import { TeacherService } from '@/services/api/TeacherService';
import { getClerkToken } from '@/lib/clerk-token';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from 'recharts';
import {
    GET_CREATOR_ACTIVITY_HEATMAP_MV,
    GET_CREATOR_ACTIVITY_TRENDS_MV,
    GET_CREATOR_ANALYTICS_OVERVIEW_MV,
    GET_CREATOR_COURSE_ANALYTICS_MV,
    GET_CREATOR_EXAM_ANALYTICS_MV,
    GET_CREATOR_EXAM_QUESTION_DIFFICULTY_MV,
    GET_CREATOR_EXAM_SCORE_DISTRIBUTION_MV,
    GET_CREATOR_RETENTION_MV,
    GET_CREATOR_TEACHER_PERFORMANCE_MV,
} from '@/services/graphql/queries';
import MetricCard from './_components/MetricCard';
import StorageLeaderboard from './_components/StorageLeaderboard';
import {
    CourseRow,
    CreatorOverview,
    ExamRow,
    HeatmapRow,
    QuestionDifficultyRow,
    RetentionRow,
    ScoreDistributionRow,
    TeacherRow,
    TrendRow,
} from './_components/types';
import { downloadCsv, extractNodes, getDateRangeFromPreset, toMinuteString } from './_components/utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GRAPHQL_ENABLED = String(process.env.NEXT_PUBLIC_ENABLE_SUPABASE_GRAPHQL || '').toLowerCase() === 'true';

type RangePreset = '7d' | '30d' | '90d' | 'custom';
type TrendGranularity = 'daily' | 'weekly' | 'monthly';

interface AnalyticsPayload {
    overview: CreatorOverview | null;
    teacherRows: TeacherRow[];
    retentionRows: RetentionRow[];
    heatmapRows: HeatmapRow[];
    courseRows: CourseRow[];
    examRows: ExamRow[];
    scoreDistributionRows: ScoreDistributionRow[];
    questionDifficultyRows: QuestionDifficultyRow[];
    trendRows: TrendRow[];
}

const EMPTY_PAYLOAD: AnalyticsPayload = {
    overview: null,
    teacherRows: [],
    retentionRows: [],
    heatmapRows: [],
    courseRows: [],
    examRows: [],
    scoreDistributionRows: [],
    questionDifficultyRows: [],
    trendRows: [],
};

export default function CreatorAnalyticsPage() {
    const apolloClient = useApolloClient();
    const { loading, role, canUse } = usePlan();
    const hasAccess = !loading && canUse('advancedAnalytics');

    const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('daily');
    const [selectedExamId, setSelectedExamId] = useState('all');

    const loadRestAnalyticsFallback = async (): Promise<AnalyticsPayload> => {
        const [adminAnalytics, stats, courses, exams] = await Promise.all([
            AdminService.getAnalytics().catch(() => null),
            TeacherService.getStats().catch(() => null),
            TeacherService.getCourses().catch(() => []),
            TeacherService.getExams().catch(() => []),
        ]);

        const labels = Array.isArray(adminAnalytics?.labels) ? adminAnalytics.labels : [];
        const activity = Array.isArray(adminAnalytics?.activity) ? adminAnalytics.activity : [];
        const now = new Date();
        const trendRows: TrendRow[] = labels.map((label: string, index: number) => {
            const date = new Date(now);
            date.setDate(now.getDate() - (labels.length - 1 - index));
            return {
                periodDate: date.toISOString().slice(0, 10),
                examSubmissions: Number(activity[index] || 0),
                courseCompletions: 0,
                activeUsers: Number(activity[index] || 0),
                refreshedAt: now.toISOString(),
            };
        });

        const courseRows: CourseRow[] = (Array.isArray(courses) ? courses : []).map((course: any) => ({
            courseId: String(course.id || ''),
            title: String(course.title || 'Untitled Course'),
            completionRate: Number(course.completionRate || 0),
            dropoffModule: Number(course.dropoffModule || 0),
            averageTimePerUnitSec: Number(course.averageTimePerUnitSec || 0),
            moduleCount: Number(course?._count?.modules || course.modules || course.moduleCount || 0),
            enrolledStudents: Number(course?._count?.students || course.students || course.studentCount || 0),
            refreshedAt: now.toISOString(),
        }));

        const examRows: ExamRow[] = (Array.isArray(exams) ? exams : []).map((exam: any) => {
            const submissionCount = Number(exam?._count?.submissions || exam.submissionCount || exam.submissions || 0);
            return {
                examId: String(exam.id || ''),
                title: String(exam.title || 'Untitled Exam'),
                submissionCount,
                passCount: Number(exam.passCount || 0),
                failCount: Number(exam.failCount || 0),
                passRate: Number(exam.passRate || 0),
                failRate: Number(exam.failRate || 0),
                averageScore: Number(exam.averageScore || 0),
                averageTimeTakenSec: Number(exam.averageTimeTakenSec || 0),
                isActive: Boolean(exam.isActive),
                startTime: exam.startTime,
                endTime: exam.endTime,
                createdAt: exam.createdAt,
                refreshedAt: now.toISOString(),
            };
        });

        return {
            overview: {
                totalExamAttempts: Number(adminAnalytics?.attempts || stats?.recentSubmissions || 0),
                averageExamScore: 0,
                activeLearnersMau: Number(stats?.totalStudents || 0),
                totalCodeExecutions: 0,
                refreshedAt: now.toISOString(),
            },
            teacherRows: [],
            retentionRows: [],
            heatmapRows: trendRows.map((row) => {
                const date = new Date(row.periodDate);
                return {
                    dayOfWeek: date.getDay(),
                    hourOfDay: 12,
                    activityCount: Number(row.examSubmissions || 0),
                    refreshedAt: now.toISOString(),
                };
            }),
            courseRows,
            examRows,
            scoreDistributionRows: [],
            questionDifficultyRows: [],
            trendRows,
        };
    };

    const { data } = useQuery({
        queryKey: ['creator-analytics-v2', hasAccess],
        enabled: hasAccess,
        queryFn: async (): Promise<AnalyticsPayload> => {
            try {
                const session = await AuthService.checkSession();
                const orgId = String(session?.orgId || '').trim();
                const token = await getClerkToken();

                if (!orgId || !UUID_REGEX.test(orgId) || !token || !GRAPHQL_ENABLED) {
                    return loadRestAnalyticsFallback();
                }

                const [
                    overviewRes,
                    teacherRes,
                    retentionRes,
                    heatmapRes,
                    courseRes,
                    examRes,
                    scoreDistRes,
                    questionDiffRes,
                    trendsRes,
                ] = await Promise.all([
                    apolloClient.query({
                        query: GET_CREATOR_ANALYTICS_OVERVIEW_MV,
                        variables: { orgId, first: 1 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_TEACHER_PERFORMANCE_MV,
                        variables: { orgId, first: 50 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_RETENTION_MV,
                        variables: { orgId, first: 80 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_ACTIVITY_HEATMAP_MV,
                        variables: { orgId, first: 200 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_COURSE_ANALYTICS_MV,
                        variables: { orgId, first: 200 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_EXAM_ANALYTICS_MV,
                        variables: { orgId, first: 200 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_EXAM_SCORE_DISTRIBUTION_MV,
                        variables: { orgId, first: 1000 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_EXAM_QUESTION_DIFFICULTY_MV,
                        variables: { orgId, first: 2000 },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_ACTIVITY_TRENDS_MV,
                        variables: { orgId, first: 365 },
                        fetchPolicy: 'network-only',
                    }),
                ]);

                const overviewData = overviewRes?.data as Record<string, unknown>;

                return {
                    overview:
                        extractNodes<CreatorOverview>(overviewData, 'creatorAnalyticsOverviewCollection')[0] || null,
                    teacherRows: extractNodes<TeacherRow>(teacherRes?.data, 'creatorTeacherPerformanceCollection'),
                    retentionRows: extractNodes<RetentionRow>(retentionRes?.data, 'creatorRetentionCohortsCollection'),
                    heatmapRows: extractNodes<HeatmapRow>(heatmapRes?.data, 'creatorActivityHeatmapCollection'),
                    courseRows: extractNodes<CourseRow>(courseRes?.data, 'creatorCourseAnalyticsCollection'),
                    examRows: extractNodes<ExamRow>(examRes?.data, 'creatorExamAnalyticsCollection'),
                    scoreDistributionRows: extractNodes<ScoreDistributionRow>(
                        scoreDistRes?.data,
                        'creatorExamScoreDistributionCollection',
                    ),
                    questionDifficultyRows: extractNodes<QuestionDifficultyRow>(
                        questionDiffRes?.data,
                        'creatorExamQuestionDifficultyCollection',
                    ),
                    trendRows: extractNodes<TrendRow>(trendsRes?.data, 'creatorActivityTrendsCollection'),
                };
            } catch {
                return loadRestAnalyticsFallback();
            }
        },
    });

    if (loading) {
        return <DashboardSkeleton type="main" userRole={role === 'ADMIN' ? 'admin' : 'teacher'} />;
    }

    if (role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 font-sans animate-fade-in">
                <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
                <p className="text-sm text-slate-500 max-w-sm">
                    Only Organization Admins have access to the Analytics dashboard.
                </p>
                <Link
                    href="/dashboard/creator"
                    className="text-xs font-black uppercase tracking-widest text-[var(--brand)] hover:underline"
                >
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const source = data || EMPTY_PAYLOAD;

    const today = new Date();
    const computedEndDate = endDate ? new Date(endDate) : today;
    const computedStartDate =
        rangePreset === 'custom'
            ? startDate
                ? new Date(startDate)
                : getDateRangeFromPreset('30d', computedEndDate)
            : getDateRangeFromPreset(rangePreset, computedEndDate);

    const isWithinDateRange = (value?: string) => {
        if (!value) return false;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed >= computedStartDate && parsed <= computedEndDate;
    };

    const filteredTrendRows = source.trendRows
        .filter((row) => isWithinDateRange(row.periodDate))
        .sort((a, b) => new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime());

    const trendSeries = (() => {
        const bucketMap = new Map<string, { examSubmissions: number; courseCompletions: number; activeUsers: number }>();

        for (const row of filteredTrendRows) {
            const date = new Date(row.periodDate);
            let key = row.periodDate;
            if (trendGranularity === 'weekly') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().slice(0, 10);
            }
            if (trendGranularity === 'monthly') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            const current = bucketMap.get(key) || { examSubmissions: 0, courseCompletions: 0, activeUsers: 0 };
            current.examSubmissions += Number(row.examSubmissions || 0);
            current.courseCompletions += Number(row.courseCompletions || 0);
            current.activeUsers += Number(row.activeUsers || 0);
            bucketMap.set(key, current);
        }

        return Array.from(bucketMap.entries())
            .map(([label, value]) => ({ label, ...value }))
            .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    })();

    const filteredExamRows = source.examRows.filter((row) => !row.createdAt || isWithinDateRange(row.createdAt));
    const selectedExamRows =
        selectedExamId === 'all' ? filteredExamRows : filteredExamRows.filter((row) => row.examId === selectedExamId);

    const scoreHistogramRows = source.scoreDistributionRows
        .filter((row) => selectedExamId === 'all' || row.examId === selectedExamId)
        .sort((a, b) => Number(a.scoreBucket || 0) - Number(b.scoreBucket || 0));

    const questionDifficultyRows = source.questionDifficultyRows
        .filter((row) => selectedExamId === 'all' || row.examId === selectedExamId)
        .sort((a, b) => Number(a.correctRate || 0) - Number(b.correctRate || 0))
        .slice(0, 12);

    const totalPass = selectedExamRows.reduce((sum, row) => sum + Number(row.passCount || 0), 0);
    const totalFail = selectedExamRows.reduce((sum, row) => sum + Number(row.failCount || 0), 0);
    const passFailRows = [
        { label: 'Pass', value: totalPass },
        { label: 'Fail', value: totalFail },
    ];

    const weightedAvgExamTimeSec = selectedExamRows.reduce(
        (sum, row) => sum + Number(row.averageTimeTakenSec || 0) * Math.max(Number(row.submissionCount || 0), 1),
        0,
    );
    const weightedSubmissionCount = selectedExamRows.reduce((sum, row) => sum + Number(row.submissionCount || 0), 0);
    const avgExamTimeSec = weightedSubmissionCount > 0 ? weightedAvgExamTimeSec / weightedSubmissionCount : 0;

    const maxHeatmap = Math.max(...source.heatmapRows.map((row) => Number(row.activityCount || 0)), 1);
    const heatmapMatrix = new Map<string, number>();
    for (const row of source.heatmapRows) {
        heatmapMatrix.set(`${row.dayOfWeek}-${row.hourOfDay}`, Number(row.activityCount || 0));
    }

    const refreshedCandidates = [
        source.overview?.refreshedAt,
        ...source.courseRows.map((row) => row.refreshedAt),
        ...source.examRows.map((row) => row.refreshedAt),
        ...source.trendRows.map((row) => row.refreshedAt),
        ...source.heatmapRows.map((row) => row.refreshedAt),
    ]
        .filter(Boolean)
        .map((value) => new Date(String(value)))
        .filter((value) => !Number.isNaN(value.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());

    const refreshedAtLabel = refreshedCandidates.length ? refreshedCandidates[0].toLocaleString() : null;

    const topTeacher = source.teacherRows[0] || null;
    const latestRetention =
        source.retentionRows.find((row) => Number(row.weekNumber) === 1) || source.retentionRows[0] || null;

    return (
        <div className="animate-fade-in font-sans pb-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">Analytics</h1>
                    <p className="text-sm font-medium mt-1 text-slate-500">
                        Precision analytics for courses, exams, activity, and engagement.
                    </p>
                    {refreshedAtLabel && (
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mt-2">
                            Data refreshed at: {refreshedAtLabel}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg p-1 border shadow-sm border-slate-200">
                    <select
                        value={rangePreset}
                        onChange={(event) => setRangePreset(event.target.value as RangePreset)}
                        className="px-3 py-2 rounded-md bg-transparent text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="custom">Custom</option>
                    </select>
                    {rangePreset === 'custom' && (
                        <>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                className="px-3 py-2 rounded-md bg-transparent border border-slate-200 text-xs font-semibold text-slate-600 outline-none"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                                className="px-3 py-2 rounded-md bg-transparent border border-slate-200 text-xs font-semibold text-slate-600 outline-none"
                            />
                        </>
                    )}
                    <button
                        onClick={() =>
                            downloadCsv(
                                'creator-activity-trends.csv',
                                filteredTrendRows.map((row) => ({
                                    periodDate: row.periodDate,
                                    examSubmissions: row.examSubmissions,
                                    courseCompletions: row.courseCompletions,
                                    activeUsers: row.activeUsers,
                                })),
                            )
                        }
                        className="px-3 py-2 rounded-md bg-[var(--color-bg-subtle)] text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        Export Trends CSV
                    </button>
                </div>
            </div>

            <PlanGate feature="advancedAnalytics" requiredPlan="Pro">
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <MetricCard label="Exam Attempts" value={Number(source.overview?.totalExamAttempts || 0)} />
                        <MetricCard
                            label="Average Score"
                            value={`${Number(source.overview?.averageExamScore || 0).toFixed(1)}%`}
                        />
                        <MetricCard label="MAU Learners" value={Number(source.overview?.activeLearnersMau || 0)} />
                        <MetricCard
                            label="Code Executions"
                            value={Number(source.overview?.totalCodeExecutions || 0)}
                        />
                    </div>

                    <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 rounded-2xl border border-slate-100 p-5 bg-slate-50/40">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">
                                    Activity Trends
                                </h3>
                                <select
                                    value={trendGranularity}
                                    onChange={(event) => setTrendGranularity(event.target.value as TrendGranularity)}
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendSeries}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                        <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="examSubmissions" stroke="#6366f1" strokeWidth={2.5} />
                                        <Line type="monotone" dataKey="courseCompletions" stroke="#10b981" strokeWidth={2.5} />
                                        <Line type="monotone" dataKey="activeUsers" stroke="#f59e0b" strokeWidth={2.5} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Retention (Week 1)
                                </p>
                                <p className="text-2xl font-black text-slate-900 mt-1">
                                    {Number(latestRetention?.retentionRate || 0).toFixed(1)}%
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Top Teacher
                                </p>
                                <p className="text-sm font-black text-slate-900 mt-1">{topTeacher?.teacherName || 'N/A'}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1">
                                    Avg Score: {Number(topTeacher?.averageExamScore || 0).toFixed(1)}%
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Avg Exam Time
                                </p>
                                <p className="text-xl font-black text-slate-900 mt-1">{toMinuteString(avgExamTimeSec)}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Per-exam Analytics</h3>
                        <div className="flex gap-2">
                            <select
                                value={selectedExamId}
                                onChange={(event) => setSelectedExamId(event.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600"
                            >
                                <option value="all">All Exams</option>
                                {source.examRows.map((exam) => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.title}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() =>
                                    downloadCsv(
                                        'creator-exam-analytics.csv',
                                        source.examRows.map((row) => ({
                                            title: row.title,
                                            submissionCount: row.submissionCount,
                                            passRate: row.passRate,
                                            failRate: row.failRate,
                                            averageScore: row.averageScore,
                                            averageTimeTakenSec: row.averageTimeTakenSec,
                                            isActive: row.isActive,
                                        })),
                                    )
                                }
                                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                            >
                                Export Exams CSV
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 rounded-2xl border border-slate-100 p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                Score Distribution Histogram
                            </p>
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={scoreHistogramRows}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="bucketLabel" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                        <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                        <Tooltip />
                                        <Bar dataKey="submissionCount" fill="#6366f1" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 p-5 flex flex-col">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Pass / Fail</p>
                            <div className="h-[220px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={passFailRows} dataKey="value" nameKey="label" outerRadius={78} innerRadius={52}>
                                            <Cell fill="#10b981" />
                                            <Cell fill="#f43f5e" />
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xl font-black text-slate-900">
                                        {totalPass + totalFail > 0 ? Math.round((totalPass / (totalPass + totalFail)) * 100) : 0}%
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pass Rate</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-100 p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                            Question Difficulty Analysis
                        </p>
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={questionDifficultyRows} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                    <YAxis type="category" dataKey="itemId" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} width={120} />
                                    <Tooltip />
                                    <Bar dataKey="correctRate" fill="#f59e0b" radius={[0, 8, 8, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">Per-course Analytics</h3>
                        <button
                            onClick={() =>
                                downloadCsv(
                                    'creator-course-analytics.csv',
                                    source.courseRows.map((row) => ({
                                        title: row.title,
                                        completionRate: row.completionRate,
                                        dropoffModule: row.dropoffModule,
                                        averageTimePerUnitSec: row.averageTimePerUnitSec,
                                        moduleCount: row.moduleCount,
                                        enrolledStudents: row.enrolledStudents,
                                    })),
                                )
                            }
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600"
                        >
                            Export Courses CSV
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-slate-100 text-left">
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Course</th>
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Completion</th>
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Drop-off Point</th>
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Time / Unit</th>
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Students</th>
                                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Modules</th>
                                </tr>
                            </thead>
                            <tbody>
                                {source.courseRows.map((row) => (
                                    <tr key={row.courseId} className="border-b border-slate-50">
                                        <td className="py-3 text-sm font-black text-slate-800">{row.title}</td>
                                        <td className="py-3 text-xs font-bold text-slate-600">{Number(row.completionRate || 0).toFixed(1)}%</td>
                                        <td className="py-3 text-xs font-bold text-slate-600">Module {row.dropoffModule}</td>
                                        <td className="py-3 text-xs font-bold text-slate-600">{toMinuteString(Number(row.averageTimePerUnitSec || 0))}</td>
                                        <td className="py-3 text-xs font-bold text-slate-600">{row.enrolledStudents}</td>
                                        <td className="py-3 text-xs font-bold text-slate-600">{row.moduleCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 mb-5">
                        Activity Heatmap (Day/Hour)
                    </h3>
                    <div className="overflow-x-auto">
                        <div className="min-w-[980px]">
                            <div className="grid grid-cols-[80px_repeat(24,minmax(20px,1fr))] gap-1 mb-2">
                                <div />
                                {Array.from({ length: 24 }, (_, hour) => (
                                    <div key={hour} className="text-[9px] text-center font-black text-slate-400">{hour}</div>
                                ))}
                            </div>

                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel, dayIndex) => (
                                <div key={dayLabel} className="grid grid-cols-[80px_repeat(24,minmax(20px,1fr))] gap-1 mb-1">
                                    <div className="text-[10px] font-black text-slate-500 flex items-center">{dayLabel}</div>
                                    {Array.from({ length: 24 }, (_, hour) => {
                                        const count = Number(heatmapMatrix.get(`${dayIndex}-${hour}`) || 0);
                                        const intensity = count / maxHeatmap;
                                        const alpha = 0.08 + intensity * 0.85;
                                        return (
                                            <div
                                                key={`${dayLabel}-${hour}`}
                                                title={`${dayLabel} ${hour}:00 → ${count} activities`}
                                                className="h-5 rounded"
                                                style={{ backgroundColor: `rgba(99,102,241,${alpha})` }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 mb-4">Activity Area View</h3>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendSeries}>
                                <defs>
                                    <linearGradient id="activeUsersArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                <Tooltip />
                                <Area type="monotone" dataKey="activeUsers" stroke="#6366f1" fill="url(#activeUsersArea)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            </PlanGate>

            {role === 'ADMIN' && (
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 mt-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 mb-5">
                        Storage Usage Leaderboard
                    </h3>
                    <StorageLeaderboard />
                </section>
            )}

            {!hasAccess && (
                <div className="text-center">
                    <Link
                        href="/dashboard/creator/billing"
                        className="text-xs font-black uppercase tracking-widest text-[var(--brand)] hover:underline"
                    >
                        Upgrade to Pro to unlock analytics
                    </Link>
                </div>
            )}
        </div>
    );
}
