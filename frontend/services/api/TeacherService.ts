import { API_BASE_URL } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';

const BASE_URL = API_BASE_URL;

const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
        ...((options.headers || {}) as any),
    };

    // Only set Content-Type to application/json if there is a body
    // and it's not a FormData object
    if (options.body && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    const authHeaders = await withClerkAuthorization(withCsrfHeader(options.method, headers));

    return fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: authHeaders,
    });
};

const parseApiError = async (res: Response, fallbackMessage: string) => {
    const payload = await res.json().catch(() => ({}) as any);
    const message =
        typeof payload?.message === 'string'
            ? payload.message
            : Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : fallbackMessage;

    const err: any = new Error(message || fallbackMessage);
    err.status = res.status;
    err.code = payload?.code;
    err.resource = payload?.resource;
    err.limit = payload?.limit;
    err.current = payload?.current;
    err.requiredPlan = payload?.requiredPlan;
    err.feature = payload?.feature;
    err.upgradeUrl = payload?.upgradeUrl;
    err.payload = payload;
    return err;
};

type CourseStreamProgress = {
    stage?: string;
    current?: number;
    total?: number;
    message?: string;
};

type CourseStreamDone = {
    result: {
        courseSummary: string;
        sections: unknown[];
        tokenUsage: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
    };
};

export interface Student {
    id: string;
    name: string;
    email?: string;
    rollNumber?: string;
    ip?: string;
    status: string;
    lastActivity: string;
    tabOuts: number;
    tabIns: number;
    vmDetected: boolean;
    vmType?: string;
    isHighRisk: boolean;
    appVersion?: string;
    monitors?: number;
    loginCount?: number;
    sleepDuration?: string;
    startTime?: string;
    endTime?: string;
    logs: any[];
}

export const TeacherService = {
    async getStats() {
        try {
            const res = await authFetch('/teacher/stats');
            if (!res.ok) throw new Error('Failed to fetch stats');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getModules() {
        try {
            const res = await authFetch('/teacher/modules');
            if (!res.ok) throw new Error('Failed to fetch modules');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getRecentSubmissions() {
        try {
            const res = await authFetch('/teacher/submissions/recent');
            if (!res.ok) throw new Error('Failed to fetch submissions');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getRecentActivity() {
        try {
            const res = await authFetch('/teacher/activity/recent');
            if (!res.ok) throw new Error('Failed to fetch recent activity');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getSubmission(examId: string, userId: string) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/submissions/${userId}`);
            if (!res.ok) throw new Error('Failed to fetch submission');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getStudents() {
        try {
            const res = await authFetch('/teacher/students');
            if (!res.ok) throw new Error('Failed to fetch students');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getStudentAnalytics(studentId: string) {
        try {
            const res = await authFetch(`/teacher/students/${studentId}/analytics`);
            if (!res.ok) throw new Error('Failed to fetch student analytics');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getStudentAttempts(studentId: string) {
        try {
            const res = await authFetch(`/teacher/students/${studentId}/attempts`);
            if (!res.ok) throw new Error('Failed to fetch student attempts');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getStudentUnitSubmissions(studentId: string) {
        try {
            const res = await authFetch(`/teacher/students/${studentId}/unit-submissions`);
            if (!res.ok) throw new Error('Failed to fetch student unit submissions');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async enrollStudent(courseId: string, studentId: string) {
        try {
            const res = await authFetch(`/teacher/courses/${courseId}/enroll/${studentId}`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to enroll student');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async enrollByEmails(courseId: string, emails: string[]) {
        try {
            const res = await authFetch(`/teacher/courses/${courseId}/enroll`, {
                method: 'POST',
                body: JSON.stringify({ emails }),
            });
            if (!res.ok) throw new Error('Failed to enroll students');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async unenrollStudent(courseId: string, studentId: string) {
        try {
            const res = await authFetch(`/teacher/courses/${courseId}/enroll/${studentId}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to unenroll student');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getCourses() {
        try {
            const res = await authFetch('/teacher/courses');
            if (!res.ok) throw new Error('Failed to fetch courses');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getCourse(id: string) {
        try {
            const res = await authFetch(`/teacher/courses/${id}`);
            if (!res.ok) throw new Error('Failed to fetch course');
            const data = await res.json();

            // Transform for Builder
            return {
                ...data,
                linkedExam: data.linkedExam
                    ? {
                          id: data.linkedExam.id,
                          title: data.linkedExam.title,
                          slug: data.linkedExam.slug,
                          duration: data.linkedExam.duration,
                          totalMarks: data.linkedExam.totalMarks,
                          questionCount: Array.isArray(data.linkedExam.questions)
                              ? data.linkedExam.questions.reduce((count: number, section: any) => {
                                    if (Array.isArray(section?.questions)) return count + section.questions.length;
                                    return count + 1;
                                }, 0)
                              : undefined,
                          passingPercentage: data.linkedExam.passingPercentage,
                          maxAttempts: data.linkedExam.maxAttempts,
                          attemptBufferMins: data.linkedExam.attemptBufferMins,
                      }
                    : null,
                certificateTemplate: data.certificateTemplate || null,
                sections: (data.modules || []).map((m: any) => ({
                    id: m.id,
                    title: m.title,
                    questions: (m.units || []).map((u: any) => ({
                        id: u.id,
                        title: u.title,
                        type: u.type,
                        ...(u.content as object),
                    })),
                })),
                tests: (data.tests || []).map((t: any) => ({
                    ...t,
                    questions: t.questions || [],
                })),
            };
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async createCourse(data: any, orgId?: string) {
        try {
            const normalizedStatus =
                data?.status === 'Published' || data?.status === 'Draft' || data?.status === 'Archived'
                    ? data.status
                    : typeof data?.isVisible === 'boolean'
                      ? data.isVisible
                          ? 'Published'
                          : 'Draft'
                      : 'Draft';

            // Transform for Backend
            const payload = {
                ...data,
                orgId, // Pass orgId if provided (for Super Admin impersonation)
                status: normalizedStatus,
                isVisible:
                    normalizedStatus === 'Published' ? true : normalizedStatus === 'Draft' ? false : !!data?.isVisible,
                modules: (data.sections || []).map((s: any, idx: number) => ({
                    title: s.title,
                    order: idx,
                    units: (s.questions || []).map((q: any, qIdx: number) => {
                        const { id, title, type, ...content } = q;
                        return { title, type, order: qIdx, content };
                    }),
                })),
            };

            const res = await authFetch('/teacher/courses', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to create course');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async updateCourse(id: string, data: any) {
        try {
            const normalizedStatus =
                data?.status === 'Published' || data?.status === 'Draft' || data?.status === 'Archived'
                    ? data.status
                    : typeof data?.isVisible === 'boolean'
                      ? data.isVisible
                          ? 'Published'
                          : 'Draft'
                      : 'Draft';

            // Transform for Backend
            const payload = {
                ...data,
                status: normalizedStatus,
                isVisible:
                    normalizedStatus === 'Published' ? true : normalizedStatus === 'Draft' ? false : !!data?.isVisible,
                modules: (data.sections || []).map((s: any, idx: number) => ({
                    id: String(s.id).startsWith('sec-') ? undefined : s.id,
                    title: s.title,
                    order: idx,
                    units: (s.questions || []).map((q: any, qIdx: number) => {
                        const { id: qId, title, type, ...content } = q;
                        return {
                            id: String(qId).startsWith('q-') ? undefined : qId,
                            title,
                            type,
                            order: qIdx,
                            content,
                        };
                    }),
                })),
                tests: (data.tests || []).map((t: any) => ({
                    ...t,
                    id: String(t.id).startsWith('test-') ? undefined : t.id,
                    questions: t.questions || [],
                })),
            };

            const res = await authFetch(`/teacher/courses/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to update course');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async linkExamToCourse(
        courseId: string,
        examId: string,
        thresholds?: {
            examPassThreshold?: number;
            examUnlockThreshold?: number;
            passingPercentage?: number;
            maxAttempts?: number;
            attemptBufferMins?: number;
        },
    ) {
        try {
            const res = await authFetch(`/teacher/courses/${courseId}/link-exam`, {
                method: 'POST',
                body: JSON.stringify({
                    examId,
                    examPassThreshold: thresholds?.examPassThreshold,
                    examUnlockThreshold: thresholds?.examUnlockThreshold,
                    passingPercentage: thresholds?.passingPercentage,
                    maxAttempts: thresholds?.maxAttempts,
                    attemptBufferMins: thresholds?.attemptBufferMins,
                }),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to link exam to course');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async unlinkExamFromCourse(courseId: string) {
        try {
            const res = await authFetch(`/teacher/courses/${courseId}/unlink-exam`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to unlink exam from course');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async deleteCourse(id: string) {
        try {
            const res = await authFetch(`/teacher/courses/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete course');
            }
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getExams() {
        try {
            const res = await authFetch('/teacher/exams');
            if (!res.ok) throw new Error('Failed to fetch exams');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getScheduledExams() {
        try {
            const res = await authFetch('/teacher/exams/scheduled');
            if (!res.ok) throw new Error('Failed to fetch scheduled exams');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getExam(id: string) {
        try {
            const res = await authFetch(`/teacher/exams/${id}`);
            if (!res.ok) throw new Error('Failed to fetch exam');
            const data = await res.json();

            if (!data) throw new Error('Exam not found');

            // Transform JSON questions to sections for builder
            return {
                ...data,
                isVisible: data.isActive,
                sections: Array.isArray(data.questions) ? data.questions : data.questions?.sections || [],
            };
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async createExam(data: any, orgId?: string) {
        try {
            const payload = {
                ...data,
                orgId, // Pass orgId if provided (for Super Admin impersonation)
                isActive: data.isVisible ?? true,
            };

            const res = await authFetch('/teacher/exams', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const shouldRetryWithoutDraftIdentity = Boolean(
                    payload?.slug && (res.status === 409 || res.status >= 500),
                );

                if (shouldRetryWithoutDraftIdentity) {
                    const retryPayload = { ...payload };
                    delete retryPayload.id;
                    delete retryPayload.slug;
                    delete retryPayload.inviteToken;

                    const retryRes = await authFetch('/teacher/exams', {
                        method: 'POST',
                        body: JSON.stringify(retryPayload),
                    });

                    if (retryRes.ok) {
                        return await retryRes.json();
                    }

                    throw await parseApiError(
                        retryRes,
                        errorData.message || 'Failed to create exam',
                    );
                }

                const message =
                    typeof errorData?.message === 'string'
                        ? errorData.message
                        : Array.isArray(errorData?.message)
                          ? errorData.message.join(', ')
                          : 'Failed to create exam';

                const err: any = new Error(message);
                err.status = res.status;
                err.code = errorData?.code;
                err.resource = errorData?.resource;
                err.limit = errorData?.limit;
                err.current = errorData?.current;
                err.requiredPlan = errorData?.requiredPlan;
                err.feature = errorData?.feature;
                err.upgradeUrl = errorData?.upgradeUrl;
                err.payload = errorData;
                throw err;
            }
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async updateExam(id: string, data: any) {
        try {
            const res = await authFetch(`/teacher/exams/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to update exam');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async deleteExam(id: string) {
        try {
            const res = await authFetch(`/teacher/exams/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete exam');
            }
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async sendExamInvites(examId: string, data: { groupIds: string[]; customMessage?: string }) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/invite`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to send exam invites');
            }
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getMonitoredStudents(examId: string) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/monitor`);
            if (!res.ok) throw new Error('Failed to fetch active students');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getFeedbacks(examId: string) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/feedbacks`);
            if (!res.ok) throw new Error('Failed to fetch feedbacks');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async terminateSession(examId: string, studentId: string) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/terminate/${studentId}`, {
                method: 'POST',
                body: JSON.stringify({}), // Fastify requires body for POST content-type application/json
            });
            if (!res.ok) throw new Error('Failed to terminate session');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async unterminateSession(examId: string, studentId: string) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/unterminate/${studentId}`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to restore session');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getExamResults(examId: string, page = 1, limit = 50) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/results?page=${page}&limit=${limit}`);
            if (!res.ok) throw new Error('Failed to fetch exam results');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async updateSubmissionScore(
        examId: string,
        sessionId: string,
        score: number,
        internalMarks?: Record<string, number>,
    ) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/submissions/${sessionId}/score`, {
                method: 'PUT',
                body: JSON.stringify({ score, internalMarks }),
            });
            if (!res.ok) throw new Error('Failed to update score');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async publishResults(examId: string) {
        try {
            const res = await authFetch(`/teacher/exams/${examId}/publish`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('Failed to publish results');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async generateCourseOutline(data: any) {
        try {
            const res = await authFetch('/ai/generate-course-outline', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to generate course outline');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async generateCourseFull(data: any) {
        try {
            const res = await authFetch('/ai/generate-course-full', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to generate full course');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async generateCourseSection(data: { title: string; description: string; section: unknown }) {
        try {
            const res = await authFetch('/ai/generate-section', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to generate section');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    generateCourseFullStream(
        data: { title: string; description: string; outline: unknown },
        handlers: {
            onProgress?: (progress: CourseStreamProgress) => void;
            onDone: (payload: CourseStreamDone['result']) => void;
            onError?: (message: string) => void;
        },
    ) {
        return new Promise<void>((resolve, reject) => {
            const params = new URLSearchParams({
                title: data.title,
                description: data.description,
                outline: JSON.stringify(data.outline),
            });

            const streamUrl = `${BASE_URL}/ai/generate-course-full/stream?${params.toString()}`;
            const source = new EventSource(streamUrl, { withCredentials: true });

            source.addEventListener('progress', (event: MessageEvent<string>) => {
                try {
                    const payload = JSON.parse(event.data) as CourseStreamProgress;
                    handlers.onProgress?.(payload);
                } catch {
                    handlers.onProgress?.({ message: event.data });
                }
            });

            source.addEventListener('done', (event: MessageEvent<string>) => {
                try {
                    const payload = JSON.parse(event.data) as CourseStreamDone;
                    handlers.onDone(payload.result);
                    source.close();
                    resolve();
                } catch (error) {
                    source.close();
                    reject(error);
                }
            });

            source.addEventListener('error', (event: MessageEvent<string>) => {
                try {
                    const payload = event.data ? (JSON.parse(event.data) as { message?: string }) : null;
                    const message = payload?.message || 'Stream connection failed';
                    handlers.onError?.(message);
                    source.close();
                    reject(new Error(message));
                } catch {
                    const message = 'Stream connection failed';
                    handlers.onError?.(message);
                    source.close();
                    reject(new Error(message));
                }
            });
        });
    },

    async generateExamOutline(data: any) {
        try {
            const res = await authFetch('/ai/generate-exam-outline', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to generate exam outline');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async generateExamFull(data: any) {
        try {
            const res = await authFetch('/ai/generate-exam-full', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to generate full exam');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    // ─── GROUPS ────────────────────────────────────────────────────────────────

    async getGroups() {
        try {
            const res = await authFetch('/teacher/groups');
            if (!res.ok) throw new Error('Failed to fetch groups');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async getGroup(id: string) {
        try {
            const res = await authFetch(`/teacher/groups/${id}`);
            if (!res.ok) throw new Error('Failed to fetch group');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async createGroup(data: { name: string; emails?: string[] }) {
        try {
            const res = await authFetch('/teacher/groups', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create group');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async updateGroup(id: string, data: { name: string }) {
        try {
            const res = await authFetch(`/teacher/groups/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update group');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async deleteGroup(id: string) {
        try {
            const res = await authFetch(`/teacher/groups/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to delete group');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async addGroupStudents(groupId: string, emails: string[]) {
        try {
            const res = await authFetch(`/teacher/groups/${groupId}/students`, {
                method: 'POST',
                body: JSON.stringify({ emails }),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to add students to group');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async removeGroupStudent(groupId: string, studentId: string) {
        try {
            const res = await authFetch(`/teacher/groups/${groupId}/students/${studentId}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to remove student from group');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async enrollGroupInCourse(courseId: string, groupId: string) {
        try {
            const res = await authFetch(`/teacher/courses/${courseId}/enroll-group/${groupId}`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to enroll group in course');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    // ─── ANNOUNCEMENTS ─────────────────────────────────────────────────────────

    async getAnnouncements() {
        try {
            const res = await authFetch('/teacher/announcements');
            if (!res.ok) throw new Error('Failed to fetch announcements');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async createAnnouncement(data: { title: string; content: string; groupIds: string[]; attachments?: any[] }) {
        try {
            const res = await authFetch('/teacher/announcements', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to create announcement');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async updateAnnouncement(
        id: string,
        data: { title: string; content: string; groupIds: string[]; attachments?: any[] },
    ) {
        try {
            const res = await authFetch(`/teacher/announcements/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update announcement');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async deleteAnnouncement(id: string) {
        try {
            const res = await authFetch(`/teacher/announcements/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Failed to delete announcement');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },

    async uploadAnnouncementFile(file: File) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await authFetch('/teacher/announcements/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'x-file-size': String(file.size),
                },
            });
            if (!res.ok) throw new Error('Failed to upload file');
            return await res.json();
        } catch (error) {
            console.error('[TeacherService] Error', error);
            throw error;
        }
    },
};
