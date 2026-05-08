export interface CreatorOverview {
    totalExamAttempts?: number;
    averageExamScore?: number;
    activeLearnersDau?: number;
    activeLearnersWau?: number;
    activeLearnersMau?: number;
    totalCodeExecutions?: number;
    refreshedAt?: string;
}

export interface TrendRow {
    periodDate: string;
    examSubmissions: number;
    courseCompletions: number;
    activeUsers: number;
    refreshedAt?: string;
}

export interface CourseRow {
    courseId: string;
    title: string;
    completionRate: number;
    dropoffModule: number;
    averageTimePerUnitSec: number;
    moduleCount: number;
    enrolledStudents: number;
    refreshedAt?: string;
}

export interface ExamRow {
    examId: string;
    title: string;
    submissionCount: number;
    passCount: number;
    failCount: number;
    passRate: number;
    failRate: number;
    averageScore: number;
    averageTimeTakenSec: number;
    isActive: boolean;
    startTime?: string;
    endTime?: string;
    createdAt?: string;
    refreshedAt?: string;
}

export interface ScoreDistributionRow {
    examId: string;
    examTitle: string;
    scoreBucket: number;
    bucketLabel: string;
    submissionCount: number;
    refreshedAt?: string;
}

export interface QuestionDifficultyRow {
    examId: string;
    itemId: string;
    attemptCount: number;
    correctCount: number;
    correctRate: number;
    difficulty: string;
    refreshedAt?: string;
}

export interface HeatmapRow {
    dayOfWeek: number;
    hourOfDay: number;
    activityCount: number;
    refreshedAt?: string;
}

export interface RetentionRow {
    cohortWeek: string;
    weekNumber: number;
    retentionRate: number;
}

export interface TeacherRow {
    teacherName: string;
    averageExamScore: number;
    studentCount: number;
}
