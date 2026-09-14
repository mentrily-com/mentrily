'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentService } from '@/services/api/StudentService';

export const BOOKMARKS_QUERY_KEY = ['student-bookmarks'];

export interface BookmarkItem {
    id: string;
    unitId: string;
    unitTitle: string;
    unitType: string;
    moduleTitle: string;
    courseTitle: string;
    bookmarkedAt: string;
    [key: string]: any;
}

export function useBookmarks<T = BookmarkItem>(enabled: boolean = true) {
    const queryClient = useQueryClient();

    const query = useQuery<T[]>({
        queryKey: BOOKMARKS_QUERY_KEY,
        queryFn: () => StudentService.getBookmarks() as Promise<T[]>,
        enabled,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    const removeBookmarkMutation = useMutation({
        mutationFn: async (id: string) => StudentService.removeBookmark(id),
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: BOOKMARKS_QUERY_KEY });
            const prev = queryClient.getQueryData<T[]>(BOOKMARKS_QUERY_KEY);
            if (prev) {
                queryClient.setQueryData(
                    BOOKMARKS_QUERY_KEY,
                    prev.filter((b: any) => b.id !== id && b.unitId !== id),
                );
            }
            return { prev };
        },
        onError: (_err, _id, context) => {
            if (context?.prev) {
                queryClient.setQueryData(BOOKMARKS_QUERY_KEY, context.prev);
            }
        },
    });

    const addBookmarkMutation = useMutation({
        mutationFn: async ({ unitId, metadata }: { unitId: string; metadata: any }) =>
            StudentService.addBookmark(unitId, metadata),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BOOKMARKS_QUERY_KEY });
        },
    });

    return {
        bookmarks: query.data || [],
        isLoading: query.isLoading,
        removeBookmark: removeBookmarkMutation.mutate,
        addBookmark: addBookmarkMutation.mutate,
        refetch: query.refetch,
    };
}
