'use client';
import { useMemo, useState } from 'react';
import { TeacherService } from '@/services/api/TeacherService';
import { useRequireAuth } from '@/hooks/requireAuthClient';
import { useQuery } from '@tanstack/react-query';
import { useApolloClient } from '@apollo/client/react';
import { useSession } from '@/hooks/useSession';
import {
    GET_CREATOR_DASHBOARD_STATS,
    GET_CREATOR_RECENT_SUBMISSIONS,
} from '@/services/graphql/queries';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GRAPHQL_ENABLED = String(process.env.NEXT_PUBLIC_ENABLE_SUPABASE_GRAPHQL || '').toLowerCase() === 'true';

export function useStudioDashboard() {
    const apolloClient = useApolloClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [tab, setTab] = useState<'Published' | 'Draft'>('Published');
    const [enrollmentModal, setEnrollmentModal] = useState({ isOpen: false, courseTitle: '', courseId: '' });
    const [viewingCourse, setViewingCourse] = useState<any | null>(null);
    const isSignedIn = useRequireAuth('/login');
    const { session, isLoading: isSessionLoading } = useSession();

    const { data, isLoading } = useQuery({
        queryKey: ['teacher-dashboard', session?.orgId || 'no-org'],
        enabled: !!isSignedIn && !isSessionLoading,
        queryFn: async () => {
            const normalizeCourses = (coursesData: any[]) =>
                (coursesData || []).map((course: any) => ({
                    id: course.id,
                    title: course.title,
                    slug: course.slug,
                    status: course.status,
                    isVisible: course.isVisible,
                    students: Number(course?._count?.students || course?.students || course?.studentCount || 0),
                    modules: Number(course?._count?.modules || course?.modules || course?.moduleCount || 0),
                    lastUpdated: course.updatedAt || course.createdAt,
                    createdAt: course.createdAt,
                    linkedExamId: course.linkedExamId || undefined,
                    certificateTemplateId: course.certificateTemplateId || undefined,
                }));

            const fallback = async () => {
                const [coursesData, statsData, recentData] = await Promise.all([
                    TeacherService.getCourses(),
                    TeacherService.getStats(),
                    TeacherService.getRecentActivity().catch(() => TeacherService.getRecentSubmissions()),
                ]);
                return { modules: normalizeCourses(coursesData), stats: statsData, recent: recentData };
            };

            const orgId = String(session?.orgId || '').trim();
            if (!orgId || !UUID_REGEX.test(orgId) || !GRAPHQL_ENABLED) {
                return fallback();
            }

            try {
                const [coursesRes, statsRes, recentRes] = await Promise.all([
                    TeacherService.getCourses(),
                    apolloClient.query({
                        query: GET_CREATOR_DASHBOARD_STATS,
                        variables: { orgId },
                        fetchPolicy: 'network-only',
                    }),
                    apolloClient.query({
                        query: GET_CREATOR_RECENT_SUBMISSIONS,
                        variables: { orgId, first: 20 },
                        fetchPolicy: 'network-only',
                    }),
                ]);

                const statsGraphData: any = statsRes?.data || {};
                const recentGraphData: any = recentRes?.data || {};

                const modulesData = normalizeCourses(coursesRes as any[]);

                const studentsCount = (statsGraphData?.creatorUserListCollection?.edges || []).length;
                const examsEdges = statsGraphData?.creatorExamListCollection?.edges || [];
                const totalExams = examsEdges.length;
                const totalSubmissions = examsEdges.reduce(
                    (acc: number, edge: any) => acc + Number(edge?.node?.submissionCount || 0),
                    0,
                );

                const statsData = {
                    totalStudents: studentsCount,
                    activeCourses: modulesData.length,
                    totalExams,
                    totalSubmissions,
                    certificatesIssued: 0,
                };

                const recentData = (recentGraphData?.learnerExamResultCollection?.edges || [])
                    .map((edge: any) => edge?.node)
                    .filter(Boolean)
                    .map((node: any) => ({
                        id: node.sessionId,
                        type: 'exam_submission',
                        name: node.userId,
                        title: node.examTitle,
                        module: node.examTitle,
                        time: node.submittedAt,
                        status: node.status,
                        score: node.score,
                    }));

                return {
                    modules: modulesData,
                    stats: statsData,
                    recent: recentData,
                };
            } catch {
                return fallback();
            }
        },
    });

    const modules: any[] = data?.modules || [];
    const normalizedModules = useMemo(() => {
        return modules.map((module: any) => {
            const rawStatus = typeof module?.status === 'string' ? module.status.trim().toLowerCase() : '';
            const normalizedStatus =
                rawStatus === 'published'
                    ? 'Published'
                    : rawStatus === 'archived'
                      ? 'Archived'
                      : rawStatus === 'draft'
                        ? 'Draft'
                        : module?.isVisible
                          ? 'Published'
                          : 'Draft';

            return { ...module, status: normalizedStatus };
        });
    }, [modules]);
    const stats = {
        ...(data?.stats || {}),
        activeCourses: Number((data?.stats as Record<string, unknown> | undefined)?.activeCourses || modules.length),
    };
    const recentParams = data?.recent || [];
    const filteredModules = useMemo(
        () =>
            normalizedModules
                .filter((module: any) => module.status === tab)
                .filter((module: any) => module.title.toLowerCase().includes(searchQuery.toLowerCase())),
        [normalizedModules, searchQuery, tab],
    );

    return {
        searchQuery,
        setSearchQuery,
        tab,
        setTab,
        enrollmentModal,
        setEnrollmentModal,
        viewingCourse,
        setViewingCourse,
        userData: session,
        filteredModules,
        recentActivity: recentParams,
        stats,
        loading: isLoading || isSessionLoading,
    };
}
