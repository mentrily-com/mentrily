import { LRUCache } from 'lru-cache';
import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';

const BASE_URL = API_BASE_URL;

// Cache configuration: Max 50 items, TTL 5 minutes
const cache = new LRUCache<string, any>({
    max: 50,
    ttl: 1000 * 60 * 5,
});

const getHeaders = () => {
    return {
        'Content-Type': 'application/json',
    };
};

const emptyAnalytics = {
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

// Helper for authorized fetch
const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    // endpoint should be relative like '/student/stats'
    const url = `${BASE_URL}${endpoint}`;
    const authHeaders = await withClerkAuthorization(
        withCsrfHeader(options.method, {
            ...options.headers,
            ...getHeaders(),
        }),
    );

    return apiFetch(url, {
        ...options,
        credentials: 'include', // Ensure cookies are sent
        headers: authHeaders,
    });
};

export interface StudentStats {
    completedModules: number;
    averageScore: number;
    streak: number;
    totalXP: number;
}

export interface StudentModule {
    title: string;
    slug: string;
    sections: number;
    totalUnits?: number;
    percent: number;
    status: string;
    linkedExam?: any;
}

export interface BrowseCourse {
    id: string;
    slug: string;
    title: string;
    shortDescription?: string | null;
    difficulty?: string | null;
    tags: string[];
    thumbnail?: string | null;
    sections: number;
    totalUnits: number;
    hasFinalExam: boolean;
    enrolled: boolean;
}

export const StudentService = {
    async getStats(forceRefresh = false): Promise<StudentStats> {
        const cacheKey = 'student_stats';
        if (!forceRefresh && cache.has(cacheKey)) {
            return cache.get(cacheKey) as StudentStats;
        }

        try {
            const res = await authFetch('/student/stats');
            if (!res.ok) throw new Error('Failed to fetch stats');
            const data = await res.json();
            cache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('[StudentService] Failed to fetch stats', error);
            throw error;
        }
    },

    async getModules(): Promise<StudentModule[]> {
        try {
            const res = await authFetch('/student/modules');
            if (!res.ok) throw new Error('Failed to fetch modules');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getCourses(_forceRefresh = false) {
        try {
            const res = await authFetch('/student/courses', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch courses');
            return await res.json();
        } catch (error) {
            // console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getBrowseCourses(): Promise<BrowseCourse[]> {
        try {
            const res = await authFetch('/student/courses/browse', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch course catalog');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error fetching browse catalog', error);
            throw error;
        }
    },

    async enrollInCourse(courseId: string): Promise<{ enrolled: boolean; courseId: string; slug: string }> {
        try {
            const res = await authFetch(`/student/courses/${courseId}/enroll`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).message || 'Failed to enroll in course');
            }
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error enrolling in course', error);
            throw error;
        }
    },

    async getAttempts() {
        try {
            const res = await authFetch('/student/attempts');
            if (!res.ok) throw new Error('Failed to fetch attempts');
            return await res.json();
        } catch (error) {
            // console.error('[StudentService] Error', error);
            throw error;
        }
    },
    async getExamResult(sessionId: string) {
        try {
            const res = await authFetch(`/student/exam/${sessionId}/result`);
            if (!res.ok) throw new Error('Failed to fetch exam result');
            return await res.json();
        } catch (error) {
            // console.error('[StudentService] Error', error);
            throw error;
        }
    },
    async getUnitAttempts() {
        try {
            const res = await authFetch('/student/unit-attempts');
            if (!res.ok) throw new Error('Failed to fetch unit attempts');
            return await res.json();
        } catch (error) {
            // console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getAnalytics() {
        try {
            const res = await authFetch('/student/analytics');
            if (!res.ok) {
                console.warn(`[StudentService] Analytics unavailable (${res.status}); using empty analytics.`);
                return emptyAnalytics;
            }
            return await res.json();
        } catch (error) {
            console.warn('[StudentService] Analytics unavailable; using empty analytics.', error);
            return emptyAnalytics;
        }
    },

    async getProfile() {
        try {
            const res = await authFetch('/student/profile');
            if (!res.ok) throw new Error('Failed to fetch profile');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async updateProfile(data: { name?: string }) {
        try {
            const res = await authFetch('/student/profile', {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update profile');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getBookmarks() {
        try {
            const res = await authFetch('/student/bookmarks');
            if (!res.ok) throw new Error('Failed to fetch bookmarks');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async addBookmark(unitId: string, metadata?: any) {
        try {
            const res = await authFetch(`/student/bookmarks/${unitId}`, {
                method: 'POST',
                body: JSON.stringify(metadata || {}),
            });
            if (!res.ok) throw new Error('Failed to add bookmark');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async removeBookmark(unitId: string) {
        try {
            const res = await authFetch(`/student/bookmarks/${unitId}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to remove bookmark');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getUnitSubmissions(unitId: string) {
        try {
            const res = await authFetch(`/student/units/${unitId}/submissions`);
            if (!res.ok) throw new Error('Failed to fetch unit submissions');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async submitUnit(unitId: string, data: { status: string; content: any; score?: number }) {
        try {
            const res = await authFetch(`/student/units/${unitId}/submit`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to submit unit');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getCourseProgress(slug: string) {
        try {
            const res = await authFetch(`/student/course/${slug}/progress`);
            if (!res.ok) throw new Error('Failed to fetch course progress');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getExamStatus(slug: string) {
        try {
            const res = await authFetch(`/student/course/${slug}/exam-status`);
            if (!res.ok) throw new Error('Failed to fetch exam status');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getUpcomingExams() {
        try {
            const res = await authFetch('/student/upcoming-exams');
            if (!res.ok) throw new Error('Failed to fetch upcoming exams');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getCertificates() {
        const res = await authFetch('/student/certificates');
        if (!res.ok) {
            const error = new Error('Failed to fetch certificates') as Error & { status?: number };
            error.status = res.status;
            throw error;
        }
        return await res.json();
    },

    async downloadCertificate(id: string) {
        const res = await authFetch(`/student/certificates/${id}/download`);
        if (!res.ok) {
            const error = new Error('Failed to download certificate') as Error & { status?: number };
            error.status = res.status;
            throw error;
        }
        return await res.json();
    },

    // ─── ANNOUNCEMENTS ─────────────────────────────────────────────────────────

    async getAnnouncements(forceRefresh = false) {
        const cacheKey = 'student_announcements';
        if (!forceRefresh && cache.has(cacheKey)) {
            return cache.get(cacheKey) as any[];
        }

        try {
            const res = await authFetch('/student/announcements');
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    // Exam sessions may not have dashboard auth; return empty list.
                    return [];
                }
                throw new Error('Failed to fetch announcements');
            }
            const data = await res.json();
            cache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },

    async getUnreadAnnouncementCount() {
        try {
            const res = await authFetch('/student/announcements/unread-count');
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    return { count: 0 };
                }
                throw new Error('Failed to fetch unread count');
            }
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            return { count: 0 };
        }
    },

    async markAnnouncementRead(id: string) {
        try {
            // Invalidate cache so next fetch is fresh
            cache.delete('student_announcements');

            const res = await authFetch(`/student/announcements/${id}/read`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to mark announcement as read');
            return await res.json();
        } catch (error) {
            console.error('[StudentService] Error', error);
            throw error;
        }
    },
};
