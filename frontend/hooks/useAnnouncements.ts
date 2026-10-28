'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentService } from '@/services/api/StudentService';
import { useSession } from '@/hooks/useSession';

export const ANNOUNCEMENTS_QUERY_KEY = ['student-announcements'];

export function useAnnouncements(enabled: boolean = true) {
    const queryClient = useQueryClient();
    // Student-only endpoints. A workspace switch away from the learner
    // persona drops this query while the learner page is still mounted;
    // without this gate it immediately refetched under the new role and 403'd.
    const { data: session } = useSession();
    const isStudentSession = String(session?.role || '').toUpperCase() === 'STUDENT';

    const query = useQuery({
        queryKey: ANNOUNCEMENTS_QUERY_KEY,
        queryFn: async () => {
            const [announcements, countData] = await Promise.all([
                StudentService.getAnnouncements(true),
                StudentService.getUnreadAnnouncementCount(),
            ]);
            return {
                announcements: Array.isArray(announcements) ? announcements : [],
                unreadCount: Number(countData?.count || 0),
            };
        },
        enabled: enabled && isStudentSession,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            return StudentService.markAnnouncementRead(id);
        },
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
            const prev = queryClient.getQueryData<{ announcements: any[]; unreadCount: number }>(
                ANNOUNCEMENTS_QUERY_KEY,
            );
            if (prev) {
                queryClient.setQueryData(ANNOUNCEMENTS_QUERY_KEY, {
                    announcements: prev.announcements.map((a: any) =>
                        a.id === id ? { ...a, isRead: true } : a,
                    ),
                    unreadCount: Math.max(0, prev.unreadCount - 1),
                });
            }
            return { prev };
        },
        onError: (_err, _id, context) => {
            if (context?.prev) {
                queryClient.setQueryData(ANNOUNCEMENTS_QUERY_KEY, context.prev);
            }
        },
    });

    return {
        announcements: query.data?.announcements ?? [],
        unreadCount: query.data?.unreadCount ?? 0,
        isLoading: query.isLoading,
        refetch: query.refetch,
        markAsRead: markAsReadMutation.mutate,
    };
}
