import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable } from '@apollo/client';
import { getClerkToken } from '@/lib/clerk-token';

function getGraphqlUrl(): string {
    return String(process.env.NEXT_PUBLIC_SUPABASE_GRAPHQL_URL || '').trim();
}

function getAnonKey(): string {
    return String(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    ).trim();
}

function shouldAttachBearer(): boolean {
    return String(process.env.NEXT_PUBLIC_SUPABASE_GRAPHQL_USE_BEARER || '').toLowerCase() === 'true';
}

type ApolloClientOptions = {
    dashboardMode?: boolean;
};

export function makeApolloClient(options: ApolloClientOptions = {}): ApolloClient<unknown> {
    const graphqlUrl = getGraphqlUrl();
    const anonKey = getAnonKey();
    const attachBearer = shouldAttachBearer();
    const defaultQueryFetchPolicy = 'cache-first';
    const defaultWatchFetchPolicy = options.dashboardMode ? 'cache-and-network' : 'cache-first';
    const uriWithApiKey = anonKey
        ? `${graphqlUrl}${graphqlUrl.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(anonKey)}`
        : graphqlUrl;

    const httpLink = new HttpLink({
        uri: uriWithApiKey,
        headers: {
            ...(anonKey ? { apikey: anonKey } : {}),
        },
    });

    const authLink = new ApolloLink((operation, forward) => {
        return new Observable((observer) => {
            void (async () => {
                try {
                    if (!anonKey) {
                        observer.error(
                            new Error('Missing Supabase anon/publishable key for GraphQL requests (apikey).'),
                        );
                        return;
                    }

                    const token = attachBearer ? await getClerkToken() : null;

                    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
                        headers: {
                            ...headers,
                            apikey: anonKey,
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                    }));

                    const subscription = forward(operation).subscribe({
                        next: (value) => observer.next(value),
                        error: (error) => observer.error(error),
                        complete: () => observer.complete(),
                    });

                    return () => subscription.unsubscribe();
                } catch (error) {
                    observer.error(error);
                }
            })();
        });
    });

    return new ApolloClient({
        link: ApolloLink.from([authLink, httpLink]),
        cache: new InMemoryCache({
            typePolicies: {
                Query: {
                    fields: {
                        courseCollection: { merge: false },
                        examCollection: { merge: false },
                        announcementCollection: { merge: false },
                        announcementReadCollection: { merge: false },
                        userProfileCollection: { merge: false },
                        creatorCourseListCollection: { merge: false },
                        creatorExamListCollection: { merge: false },
                        creatorUserListCollection: { merge: false },
                        learnerEnrolledCourseCollection: { merge: false },
                        learnerExamResultCollection: { merge: false },
                        examMonitorViewCollection: { merge: false },
                        bookmarkCollection: { merge: false },
                        userCollection: { merge: false },
                        creatorAnalyticsOverviewCollection: { merge: false },
                        creatorActivityHeatmapCollection: { merge: false },
                        creatorRetentionCohortsCollection: { merge: false },
                        creatorTeacherPerformanceCollection: { merge: false },
                        creatorCodeExecutionDailyCollection: { merge: false },
                        creatorStudentBenchmarksCollection: { merge: false },
                        learnerStreakCalendarCollection: { merge: false },
                    },
                },
                Course: { keyFields: ['id'] },
                Exam: { keyFields: ['id'] },
                User: { keyFields: ['id'] },
                UserProfile: { keyFields: ['id'] },
                Announcement: { keyFields: ['id'] },
                Bookmark: { keyFields: ['id'] },
                CourseCollection: { keyFields: false },
                CourseEdge: { keyFields: false },
                ExamCollection: { keyFields: false },
                ExamEdge: { keyFields: false },
                AnnouncementCollection: { keyFields: false },
                AnnouncementEdge: { keyFields: false },
                AnnouncementReadCollection: { keyFields: false },
                AnnouncementReadEdge: { keyFields: false },
                CreatorCourseListCollection: { keyFields: false },
                CreatorCourseListEdge: { keyFields: false },
                CreatorExamListCollection: { keyFields: false },
                CreatorExamListEdge: { keyFields: false },
                CreatorUserListCollection: { keyFields: false },
                CreatorUserListEdge: { keyFields: false },
                LearnerEnrolledCourseCollection: { keyFields: false },
                LearnerEnrolledCourseEdge: { keyFields: false },
                LearnerExamResultCollection: { keyFields: false },
                LearnerExamResultEdge: { keyFields: false },
                ExamMonitorViewCollection: { keyFields: false },
                ExamMonitorViewEdge: { keyFields: false },
                BookmarkCollection: { keyFields: false },
                BookmarkEdge: { keyFields: false },
                UserCollection: { keyFields: false },
                UserEdge: { keyFields: false },
                CreatorAnalyticsOverviewCollection: { keyFields: false },
                CreatorAnalyticsOverviewEdge: { keyFields: false },
                CreatorActivityHeatmapCollection: { keyFields: false },
                CreatorActivityHeatmapEdge: { keyFields: false },
                CreatorRetentionCohortsCollection: { keyFields: false },
                CreatorRetentionCohortsEdge: { keyFields: false },
                CreatorTeacherPerformanceCollection: { keyFields: false },
                CreatorTeacherPerformanceEdge: { keyFields: false },
                CreatorCodeExecutionDailyCollection: { keyFields: false },
                CreatorCodeExecutionDailyEdge: { keyFields: false },
                CreatorStudentBenchmarksCollection: { keyFields: false },
                CreatorStudentBenchmarksEdge: { keyFields: false },
                LearnerStreakCalendarCollection: { keyFields: false },
                LearnerStreakCalendarEdge: { keyFields: false },
            },
        }),
        defaultOptions: {
            query: {
                fetchPolicy: defaultQueryFetchPolicy,
            },
            watchQuery: {
                fetchPolicy: defaultWatchFetchPolicy,
                nextFetchPolicy: defaultWatchFetchPolicy,
                errorPolicy: 'all',
            },
        },
    });
}
