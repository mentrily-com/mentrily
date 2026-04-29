import { gql } from '@apollo/client';

export const GET_COURSES_COLLECTION = gql`
    query GetCoursesCollection($first: Int = 20) {
        courseCollection(first: $first) {
            edges {
                node {
                    id
                    title
                    slug
                    status
                    isVisible
                    createdAt
                }
            }
        }
    }
`;

export const GET_LEARNER_ANNOUNCEMENTS = gql`
    query GetLearnerAnnouncements($first: Int = 50, $readFirst: Int = 200) {
        announcementCollection(first: $first) {
            edges {
                node {
                    id
                    title
                    createdAt
                }
            }
        }
        announcementReadCollection(first: $readFirst) {
            edges {
                node {
                    announcementId
                }
            }
        }
    }
`;

export const GET_CREATOR_DASHBOARD_STATS = gql`
    query GetCreatorDashboardStats($orgId: UUID!) {
        creatorUserListCollection(filter: { orgId: { eq: $orgId }, role: { eq: STUDENT } }) {
            edges {
                node {
                    id
                }
            }
        }
        creatorCourseListCollection(filter: { orgId: { eq: $orgId } }) {
            edges {
                node {
                    id
                }
            }
        }
        creatorExamListCollection(filter: { orgId: { eq: $orgId } }) {
            edges {
                node {
                    id
                    submissionCount
                }
            }
        }
    }
`;

export const GET_CREATOR_COURSES = gql`
    query GetCreatorCourses($orgId: UUID!, $first: Int = 100) {
        creatorCourseListCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ createdAt: DescNullsLast }]
        ) {
            edges {
                node {
                    id
                    title
                    slug
                    status
                    isVisible
                    createdAt
                    orgId
                    creatorId
                    studentCount
                    moduleCount
                    linkedExamId
                    certificateTemplateId
                }
            }
        }
    }
`;

export const GET_CREATOR_EXAMS = gql`
    query GetCreatorExams($orgId: UUID!, $first: Int = 100) {
        creatorExamListCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ createdAt: DescNullsLast }]
        ) {
            edges {
                node {
                    id
                    slug
                    title
                    duration
                    isActive
                    resultsPublished
                    startTime
                    endTime
                    orgId
                    creatorId
                    createdAt
                    submissionCount
                }
            }
        }
    }
`;

export const GET_CREATOR_USERS = gql`
    query GetCreatorUsers($orgId: UUID!, $first: Int = 200) {
        creatorUserListCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ createdAt: DescNullsLast }]
        ) {
            edges {
                node {
                    id
                    name
                    email
                    role
                    department
                    isActive
                    orgId
                    createdAt
                }
            }
        }
    }
`;

export const GET_CREATOR_RECENT_SUBMISSIONS = gql`
    query GetCreatorRecentSubmissions($orgId: UUID!, $first: Int = 20) {
        learnerExamResultCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ submittedAt: DescNullsLast }]
        ) {
            edges {
                node {
                    sessionId
                    userId
                    examId
                    examTitle
                    score
                    status
                    submittedAt
                }
            }
        }
    }
`;

export const GET_LEARNER_ENROLLED_COURSES = gql`
    query GetLearnerEnrolledCourses($userId: UUID!, $first: Int = 200) {
        learnerEnrolledCourseCollection(
            first: $first
            filter: { userId: { eq: $userId } }
            orderBy: [{ createdAt: DescNullsLast }]
        ) {
            edges {
                node {
                    id
                    title
                    slug
                    status
                    isVisible
                    orgId
                    userId
                    progressPercent
                    progressStatus
                    completedCount
                    totalUnits
                    createdAt
                }
            }
        }
    }
`;

export const GET_LEARNER_EXAM_RESULTS = gql`
    query GetLearnerExamResults($userId: UUID!, $first: Int = 100) {
        learnerExamResultCollection(
            first: $first
            filter: { userId: { eq: $userId } }
            orderBy: [{ submittedAt: DescNullsLast }]
        ) {
            edges {
                node {
                    sessionId
                    userId
                    examId
                    status
                    score
                    startTime
                    endTime
                    submittedAt
                    examTitle
                    examSlug
                    orgId
                    duration
                    resultsPublished
                }
            }
        }
    }
`;

export const GET_LEARNER_BOOKMARKS = gql`
    query GetLearnerBookmarks($userId: UUID!, $first: Int = 100) {
        bookmarkCollection(
            first: $first
            filter: { userId: { eq: $userId } }
            orderBy: [{ createdAt: DescNullsLast }]
        ) {
            edges {
                node {
                    id
                    userId
                    unitId
                    customId
                    title
                    type
                    courseTitle
                    moduleTitle
                    createdAt
                }
            }
        }
    }
`;

export const GET_LEARNER_STREAK_AND_XP = gql`
    query GetLearnerStreakAndXp($id: UUID!) {
        userCollection(filter: { id: { eq: $id } }, first: 1) {
            edges {
                node {
                    id
                    dailyStreak
                    totalXP
                    lastActivityDate
                }
            }
        }
    }
`;

export const GET_EXAM_DETAILS = gql`
    query GetExamDetails($examId: UUID!, $first: Int = 1) {
        creatorExamListCollection(first: $first, filter: { id: { eq: $examId } }) {
            edges {
                node {
                    id
                    slug
                    title
                    duration
                    isActive
                    resultsPublished
                    startTime
                    endTime
                    orgId
                    creatorId
                    createdAt
                    submissionCount
                }
            }
        }
        examCollection(filter: { id: { eq: $examId } }, first: 1) {
            edges {
                node {
                    questions
                    testCode
                    examMode
                    strictness
                }
            }
        }
    }
`;

export const GET_EXAM_SESSIONS = gql`
    query GetExamSessions($examId: UUID!, $first: Int = 200) {
        examMonitorViewCollection(
            first: $first
            filter: { examId: { eq: $examId } }
            orderBy: [{ sessionStartTime: DescNullsLast }]
        ) {
            edges {
                node {
                    examId
                    sessionId
                    userId
                    sessionStatus
                    score
                    sessionStartTime
                    sessionEndTime
                    violationCount
                }
            }
        }
    }
`;

export const GET_EXAM_RESULTS_LIST = gql`
    query GetExamResultsList($examId: UUID!, $first: Int = 200) {
        learnerExamResultCollection(
            first: $first
            filter: { examId: { eq: $examId } }
            orderBy: [{ submittedAt: DescNullsLast }]
        ) {
            edges {
                node {
                    sessionId
                    userId
                    examId
                    examTitle
                    score
                    status
                    submittedAt
                }
            }
        }
    }
`;

export const GET_ANALYTICS_OVERVIEW = gql`
    query GetAnalyticsOverview($orgId: UUID!, $first: Int = 200) {
        learnerExamResultCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ submittedAt: AscNullsFirst }]
        ) {
            edges {
                node {
                    submittedAt
                    score
                    userId
                    examId
                }
            }
        }
    }
`;

export const GET_ANALYTICS_COURSE_MASTERY = gql`
    query GetAnalyticsCourseMastery($orgId: UUID!, $first: Int = 500) {
        learnerEnrolledCourseCollection(first: $first, filter: { orgId: { eq: $orgId } }) {
            edges {
                node {
                    id
                    title
                    progressPercent
                    progressStatus
                }
            }
        }
    }
`;

export const GET_ANALYTICS_RETENTION = gql`
    query GetAnalyticsRetention($orgId: UUID!, $first: Int = 1000) {
        learnerExamResultCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ submittedAt: AscNullsFirst }]
        ) {
            edges {
                node {
                    submittedAt
                    userId
                }
            }
        }
    }
`;

export const GET_CREATOR_ANALYTICS_OVERVIEW_MV = gql`
    query GetCreatorAnalyticsOverviewMv($orgId: UUID!, $first: Int = 1) {
        creatorAnalyticsOverviewCollection(first: $first, filter: { orgId: { eq: $orgId } }) {
            edges {
                node {
                    orgId
                    totalExamAttempts
                    averageExamScore
                    activeLearnersDau
                    activeLearnersWau
                    activeLearnersMau
                    totalUnitAttempts
                    totalCodeExecutions
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_CREATOR_CODE_EXEC_DAILY_MV = gql`
    query GetCreatorCodeExecDailyMv($orgId: UUID!, $first: Int = 30) {
        creatorCodeExecutionDailyCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ day: DescNullsLast }]
        ) {
            edges {
                node {
                    orgId
                    day
                    executionCount
                    successCount
                    averageScore
                }
            }
        }
    }
`;

export const GET_CREATOR_RETENTION_MV = gql`
    query GetCreatorRetentionMv($orgId: UUID!, $first: Int = 20) {
        creatorRetentionCohortsCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ cohortWeek: DescNullsLast }, { weekNumber: AscNullsFirst }]
        ) {
            edges {
                node {
                    orgId
                    cohortWeek
                    weekNumber
                    retainedUsers
                    cohortSize
                    retentionRate
                }
            }
        }
    }
`;

export const GET_CREATOR_TEACHER_PERFORMANCE_MV = gql`
    query GetCreatorTeacherPerformanceMv($orgId: UUID!, $first: Int = 100) {
        creatorTeacherPerformanceCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ averageExamScore: DescNullsLast }]
        ) {
            edges {
                node {
                    orgId
                    teacherId
                    teacherName
                    courseCount
                    examCount
                    studentCount
                    averageExamScore
                }
            }
        }
    }
`;

export const GET_CREATOR_ACTIVITY_HEATMAP_MV = gql`
    query GetCreatorActivityHeatmapMv($orgId: UUID!, $first: Int = 200) {
        creatorActivityHeatmapCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ dayOfWeek: AscNullsFirst }, { hourOfDay: AscNullsFirst }]
        ) {
            edges {
                node {
                    orgId
                    dayOfWeek
                    hourOfDay
                    activityCount
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_CREATOR_COURSE_ANALYTICS_MV = gql`
    query GetCreatorCourseAnalyticsMv($orgId: UUID!, $first: Int = 200) {
        creatorCourseAnalyticsCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ completionRate: DescNullsLast }]
        ) {
            edges {
                node {
                    orgId
                    courseId
                    title
                    completionRate
                    dropoffModule
                    averageTimePerUnitSec
                    moduleCount
                    enrolledStudents
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_CREATOR_EXAM_ANALYTICS_MV = gql`
    query GetCreatorExamAnalyticsMv($orgId: UUID!, $first: Int = 200) {
        creatorExamAnalyticsCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ createdAt: DescNullsLast }]
        ) {
            edges {
                node {
                    orgId
                    examId
                    title
                    submissionCount
                    passCount
                    failCount
                    passRate
                    failRate
                    averageScore
                    averageTimeTakenSec
                    isActive
                    startTime
                    endTime
                    createdAt
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_CREATOR_EXAM_SCORE_DISTRIBUTION_MV = gql`
    query GetCreatorExamScoreDistributionMv($orgId: UUID!, $first: Int = 500) {
        creatorExamScoreDistributionCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ examId: AscNullsFirst }, { scoreBucket: AscNullsFirst }]
        ) {
            edges {
                node {
                    orgId
                    examId
                    examTitle
                    scoreBucket
                    bucketLabel
                    submissionCount
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_CREATOR_EXAM_QUESTION_DIFFICULTY_MV = gql`
    query GetCreatorExamQuestionDifficultyMv($orgId: UUID!, $first: Int = 1000) {
        creatorExamQuestionDifficultyCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ correctRate: AscNullsFirst }]
        ) {
            edges {
                node {
                    orgId
                    examId
                    itemId
                    attemptCount
                    correctCount
                    correctRate
                    difficulty
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_CREATOR_ACTIVITY_TRENDS_MV = gql`
    query GetCreatorActivityTrendsMv($orgId: UUID!, $first: Int = 365) {
        creatorActivityTrendsCollection(
            first: $first
            filter: { orgId: { eq: $orgId } }
            orderBy: [{ periodDate: DescNullsLast }]
        ) {
            edges {
                node {
                    orgId
                    periodDate
                    examSubmissions
                    courseCompletions
                    activeUsers
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_LEARNER_BENCHMARK_MV = gql`
    query GetLearnerBenchmarkMv($orgId: UUID!, $userId: UUID!, $first: Int = 1) {
        creatorStudentBenchmarksCollection(first: $first, filter: { orgId: { eq: $orgId }, userId: { eq: $userId } }) {
            edges {
                node {
                    orgId
                    userId
                    averageScore
                    averageTimeTakenSec
                    scorePercentile
                    attemptCount
                    refreshedAt
                }
            }
        }
    }
`;

export const GET_LEARNER_STREAK_CALENDAR_MV = gql`
    query GetLearnerStreakCalendarMv($orgId: UUID!, $userId: UUID!, $first: Int = 60) {
        learnerStreakCalendarCollection(
            first: $first
            filter: { orgId: { eq: $orgId }, userId: { eq: $userId } }
            orderBy: [{ activityDate: DescNullsLast }]
        ) {
            edges {
                node {
                    orgId
                    userId
                    activityDate
                    activityCount
                    timeSpentSec
                    refreshedAt
                }
            }
        }
    }
`;
