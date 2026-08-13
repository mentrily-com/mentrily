import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';
import { UploadService } from './UploadService';

const BASE_URL = API_BASE_URL;

const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = withCsrfHeader(options.method, {
        'Content-Type': 'application/json',
        ...((options.headers || {}) as any),
    });
    const authHeaders = await withClerkAuthorization(headers);

    return apiFetch(`${BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: authHeaders,
    });
};

export const AdminService = {
    async getStats(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/stats${query}`);
            if (!res.ok) throw new Error('Failed to fetch admin stats');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching stats', error);
            throw error;
        }
    },

    async getUsers(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/users${query}`);
            if (!res.ok) throw new Error('Failed to fetch users');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching users', error);
            throw error;
        }
    },

    async createUser(userData: any, orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/users${query}`, {
                method: 'POST',
                body: JSON.stringify(userData),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to create user');
            }
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error creating user', error);
            throw error;
        }
    },

    async createUsersBulk(users: any[], orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/users/bulk${query}`, {
                method: 'POST',
                body: JSON.stringify({ users }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to import users');
            }
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error importing users', error);
            throw error;
        }
    },

    async inviteUser(data: { email: string; name?: string; role?: string; dept?: string; id?: string }, orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/users/invite${query}`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to send invitation');
            }
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error inviting user', error);
            throw error;
        }
    },

    async getSystemLogs(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/logs${query}`);
            if (!res.ok) throw new Error('Failed to fetch logs');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching logs', error);
            throw error;
        }
    },

    async getAnalytics(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/analytics${query}`);
            if (!res.ok) throw new Error('Failed to fetch analytics');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching analytics', error);
            throw error;
        }
    },

    async getExams(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/exams${query}`);
            if (!res.ok) throw new Error('Failed to fetch admin exams');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching exams', error);
            throw error;
        }
    },

    async getCourses(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/courses${query}`);
            if (!res.ok) throw new Error('Failed to fetch admin courses');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching courses', error);
            throw error;
        }
    },

    async getSettings(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/settings${query}`);
            if (!res.ok) throw new Error('Failed to fetch admin settings');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching settings', error);
            throw error;
        }
    },

    async getOnboardingStatus(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/onboarding-status${query}`);
            if (!res.ok) throw new Error('Failed to fetch onboarding status');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching onboarding status', error);
            throw error;
        }
    },

    async updateSettings(data: any, orgId?: string) {
        try {
            const logo = data.logo instanceof File ? (await UploadService.uploadFile('org-logo', data.logo)).url : data.logo;
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/settings${query}`, {
                method: 'PATCH',
                body: JSON.stringify({ ...data, logo }),
            });

            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to update admin settings');
            }

            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error updating settings', error);
            throw error;
        }
    },

    async toggleUserStatus(id: string) {
        try {
            const res = await authFetch(`/admin/users/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to update user status');
            }
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error toggling status', error);
            throw error;
        }
    },

    async updateUserRole(id: string, role: string) {
        try {
            const res = await authFetch(`/admin/users/${id}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const text = await res.text();
                let errorData: any = {};
                try {
                    errorData = JSON.parse(text);
                } catch (e) {
                    errorData = { message: text };
                }
                throw new Error(errorData.message || 'Failed to update user role');
            }
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error updating user role', error);
            throw error;
        }
    },

    async deleteUser(id: string) {
        try {
            const res = await authFetch(`/admin/users/${id}`, {
                method: 'DELETE',
                body: JSON.stringify({}), // Fastify requires a body if Content-Type is application/json
            });
            if (!res.ok) {
                const text = await res.text();
                let errorData: any = {};
                try {
                    errorData = JSON.parse(text);
                } catch (e) {
                    errorData = { message: text };
                }
                console.error('[AdminService] Delete failed:', res.status, errorData);
                throw new Error(errorData.message || 'Failed to delete user');
            }
            return await res.json().catch(() => ({ success: true }));
        } catch (error) {
            console.error('[AdminService] Error deleting user', error);
            throw error;
        }
    },

    async getStorageUsers(orgId?: string) {
        try {
            const query = orgId ? `?orgId=${orgId}` : '';
            const res = await authFetch(`/admin/storage/users${query}`);
            if (!res.ok) throw new Error('Failed to fetch storage users');
            return await res.json();
        } catch (error) {
            console.error('[AdminService] Error fetching storage users', error);
            throw error;
        }
    },
};
