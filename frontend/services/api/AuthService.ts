import { API_BASE_URL, apiFetch } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { getClerkToken, withClerkAuthorization } from '@/lib/clerk-token';
import { setActiveOrgId, clearActiveOrgId, setActivePersona, clearActivePersona } from '@/lib/active-org';
import { UploadService } from './UploadService';

export interface WorkspaceMembership {
    orgId: string;
    orgName: string;
    orgSlug: string | null;
    /** Full subdomain host (e.g. "acme.mentrily.com"); null for personal orgs. */
    orgDomain?: string | null;
    /** STRICT orgs are only usable on their own subdomain (see backend org-kind.ts). */
    orgKind?: 'PERSONAL' | 'OPEN' | 'STRICT';
    role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
    isHome: boolean;
}

const BASE_URL = API_BASE_URL;

const hasCsrfCookie = () => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split('; ').some((row) => row.startsWith('csrf_token='));
};

const ensureCsrfCookie = async () => {
    if (hasCsrfCookie()) return;

    try {
        await apiFetch(`${BASE_URL}/exam/app-config`, {
            method: 'GET',
            credentials: 'include',
        });
    } catch {}
};

let inFlightSessionCheck: Promise<any> | null = null;
let lastSessionSnapshot: any = null;
let lastSessionAt = 0;
let unauthorizedCooldownUntil = 0;

// Key used by useSession to persist the session across page loads as a fast
// placeholder. Must be wiped on every workspace switch so the new page never
// shows the previous persona's role while the real session fetch is in flight.
const SESSION_SNAPSHOT_STORAGE_KEY = 'bc-session-snapshot';

const clearStoredSessionSnapshot = () => {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_SNAPSHOT_STORAGE_KEY);
    }
};

const resetSessionCache = () => {
    inFlightSessionCheck = null;
    lastSessionSnapshot = null;
    lastSessionAt = 0;
    unauthorizedCooldownUntil = 0;
    // Also wipe the localStorage snapshot so the next page load does not
    // serve a stale role as placeholder data while the fresh fetch is in flight.
    clearStoredSessionSnapshot();
};

export const AuthService = {
    resetSessionCache,

    getUser() {
        return lastSessionSnapshot;
    },

    async checkSession(
        strictExisting = false,
        options?: {
            flow?: 'signup' | 'registration';
            allowProvisioning?: boolean;
            bypassCache?: boolean;
        },
    ): Promise<any> {
        const flow = options?.flow;
        const allowProvisioning = options?.allowProvisioning === true;
        const bypassCache = options?.bypassCache === true || Boolean(flow) || allowProvisioning;
        const now = Date.now();
        if (!strictExisting && !bypassCache && unauthorizedCooldownUntil > now) {
            return null;
        }

        if (!strictExisting && !bypassCache && lastSessionSnapshot && now - lastSessionAt < 4000) {
            return lastSessionSnapshot;
        }

        if (!strictExisting && !bypassCache && inFlightSessionCheck) {
            return inFlightSessionCheck;
        }

        try {
            inFlightSessionCheck = (async () => {
                const token = await getClerkToken();
                if (!token) {
                    return null;
                }

                const authHeaders = await withClerkAuthorization({ 'Content-Type': 'application/json' });
                const params = new URLSearchParams();
                if (strictExisting) params.set('strict', '1');
                if (flow) params.set('flow', flow);
                if (allowProvisioning) params.set('allowProvisioning', '1');
                const query = params.toString();

                const res = await apiFetch(`${BASE_URL}/auth/me${query ? `?${query}` : ''}`, {
                    headers: authHeaders,
                    credentials: 'include',
                    cache: 'no-store',
                });

                if (!res.ok) {
                    if (res.status === 403) {
                        throw new Error('FORBIDDEN');
                    }
                    if (!strictExisting && !bypassCache && res.status === 401) {
                        unauthorizedCooldownUntil = Date.now() + 10000;
                    }
                    return null;
                }

                const payload = await res.json();
                lastSessionSnapshot = payload;
                lastSessionAt = Date.now();
                if (!strictExisting && !bypassCache) {
                    unauthorizedCooldownUntil = 0;
                }
                return payload;
            })();

            return await inFlightSessionCheck;
        } catch (e: any) {
            if (e?.message === 'FORBIDDEN') {
                throw e;
            }
            return null;
        } finally {
            inFlightSessionCheck = null;
        }
    },

    async checkSessionForSignup(): Promise<any> {
        return this.checkSession(false, {
            flow: 'signup',
            allowProvisioning: true,
            bypassCache: true,
        });
    },

    async examLogin(testCode: string, slug?: string): Promise<any> {
        try {
            localStorage.removeItem('currentExamSessionId');
            await ensureCsrfCookie();
            const authHeaders = await withClerkAuthorization(
                withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
            );

            const res = await apiFetch(`${BASE_URL}/auth/exam-login`, {
                method: 'POST',
                headers: authHeaders,
                credentials: 'include',
                body: JSON.stringify({ testCode, slug }),
            });

            if (res.status === 403) {
                await ensureCsrfCookie();
                const retryHeaders = await withClerkAuthorization(
                    withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
                );
                const retryRes = await apiFetch(`${BASE_URL}/auth/exam-login`, {
                    method: 'POST',
                    headers: retryHeaders,
                    credentials: 'include',
                    body: JSON.stringify({ testCode, slug }),
                });

                if (!retryRes.ok) {
                    const retryError = await retryRes.json().catch(() => ({}));
                    throw new Error(retryError.message || 'Exam login failed');
                }

                return await retryRes.json();
            }

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Exam login failed');
            }

            return await res.json();
        } catch (error) {
            console.error('[AuthService] Exam login error:', error);
            throw error;
        }
    },

    async verifyExamTestCode(testCode: string, slug?: string): Promise<any> {
        try {
            const res = await apiFetch(`${BASE_URL}/auth/exam-login/verify-code`, {
                method: 'POST',
                headers: withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify({ testCode, slug }),
            });

            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error.message || 'Invalid test code');
            }

            return await res.json();
        } catch (error) {
            console.error('[AuthService] verifyExamTestCode error:', error);
            throw error;
        }
    },

    async updateProfile(data: { name?: string }): Promise<any> {
        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('PATCH', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/profile`, {
            method: 'PATCH',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify({ name: data.name }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to update profile');
        }

        const updatedUser = await res.json();
        resetSessionCache();
        return updatedUser;
    },

    async removeProfilePicture(): Promise<any> {
        const authHeaders = await withClerkAuthorization(withCsrfHeader('DELETE'));
        const res = await apiFetch(`${BASE_URL}/auth/profile/picture`, {
            method: 'DELETE',
            headers: authHeaders,
            credentials: 'include',
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to remove profile picture');
        }

        await res.json().catch(() => null);
        resetSessionCache();
        return await this.checkSession(true);
    },

    async changePassword(data: { currentPass: string; newPass: string }): Promise<void> {
        if (typeof window === 'undefined') {
            throw new Error('Password update is only available in the browser');
        }

        const clerk = (
            window as Window & {
                Clerk?: {
                    user?: {
                        updatePassword?: (params: {
                            currentPassword?: string;
                            newPassword: string;
                            signOutOfOtherSessions?: boolean;
                        }) => Promise<unknown>;
                    };
                };
            }
        ).Clerk;

        const updatePassword = clerk?.user?.updatePassword;
        if (!updatePassword) {
            throw new Error('Password update is currently unavailable');
        }

        await updatePassword({
            currentPassword: data.currentPass,
            newPassword: data.newPass,
            signOutOfOtherSessions: true,
        });
    },

    logout() {
        resetSessionCache();
        clearActiveOrgId();
        clearActivePersona();
        if (typeof window !== 'undefined') {
            window.location.href = '/logout';
        }
    },

    async listMemberships(): Promise<WorkspaceMembership[]> {
        const authHeaders = await withClerkAuthorization({ 'Content-Type': 'application/json' });
        const res = await apiFetch(`${BASE_URL}/auth/memberships`, {
            headers: authHeaders,
            credentials: 'include',
            cache: 'no-store',
        });

        if (!res.ok) {
            throw new Error('Failed to load workspaces');
        }

        return await res.json();
    },

    // Switching never touches the user's home org/role — it only changes
    // which membership subsequent requests resolve against. Resets the
    // cache and refetches /auth/me under the new org so callers get back a
    // fully up-to-date session in one round trip.
    async switchOrg(orgId: string, options?: { asLearner?: boolean }): Promise<any> {
        // Eagerly set local storage state so optimistic UI navigation and any
        // parallel /auth/me fetches immediately pick up the new headers.
        clearStoredSessionSnapshot();
        setActiveOrgId(orgId);
        if (options?.asLearner) {
            setActivePersona('learner');
        } else {
            clearActivePersona();
        }
        resetSessionCache();

        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/switch-org`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify({ orgId }),
        });

        if (!res.ok) {
            // Revert state if the switch failed
            clearActiveOrgId();
            clearActivePersona();
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to switch workspace');
        }

        return await this.checkSession(true);
    },

    // Returns to the user's home (Learner) persona. Clears the client's
    // active-org pointer AND resets it server-side (lastActiveOrgId) so the
    // next /auth/me resolves back to the home org/role — needed because a
    // learner's home can be org-less, which switchOrg can't express.
    async switchToHome(): Promise<any> {
        clearStoredSessionSnapshot();
        // Home can be any role (a signup-creator's home is TEACHER), so an
        // active "act as learner" persona must be dropped too — otherwise the
        // next request still resolves as an org-less Student.
        clearActivePersona();
        clearActiveOrgId();
        resetSessionCache();

        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/switch-home`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify({}),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to switch to your learner workspace');
        }

        return await this.checkSession(true);
    },

    // Act as a learner. No backend mutation needed — flipping the persona flag
    // makes every subsequent request carry X-Active-Persona: learner, which the
    // backend resolves as an org-less Student. Lets a creator (even one who was
    // never a learner) use the learner experience and switch back anytime.
    async switchToLearner(): Promise<any> {
        clearStoredSessionSnapshot();
        clearActiveOrgId();
        setActivePersona('learner');
        resetSessionCache();
        return await this.checkSession(true);
    },

    // Self-serve Creator persona — grants a Teacher membership on the
    // caller's own personal org without touching any other role/org they
    // already have. Does NOT switch to it; callers should follow up with
    // switchOrg(orgId) once they want to land on the new dashboard.
    async becomeCreator(): Promise<{ orgId: string; role: 'TEACHER' }> {
        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/become-creator`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            // Content-Type is application/json, so Fastify rejects an empty
            // body ("Body cannot be empty…"). This endpoint takes no input, so
            // send an empty JSON object.
            body: JSON.stringify({}),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to set up your creator workspace');
        }

        return await res.json();
    },

    async uploadBugReportImage(file: File): Promise<{ url: string; name: string; type: string; size: number }> {
        // Uploads directly to S3 (browser -> S3) — file bytes never transit
        // this backend or the Vercel-hosted frontend.
        return UploadService.uploadFile('bug-report', file);
    },

    async createBugReport(data: {
        title: string;
        description: string;
        attachments?: { name: string; url: string; type: string; size: number }[];
    }): Promise<any> {
        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/bug-reports`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to submit bug report');
        }

        return await res.json();
    },

    async selectRole(role: 'STUDENT' | 'TEACHER'): Promise<any> {
        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/select-role`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify({ role }),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to select role');
        }

        const payload = await res.json();
        resetSessionCache();
        return payload;
    },

    async selectRoleCreator(): Promise<unknown> {
        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/select-role-creator`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify({}),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to create organization and select role');
        }

        const payload = await res.json();
        // Signup-creators get a personal org provisioned server-side; point
        // subsequent requests at it immediately (same as the become-creator
        // flow does via switchOrg) so the creator dashboard resolves against
        // their own org from the very first render.
        const provisionedOrgId = String((payload as { orgId?: string })?.orgId || '').trim();
        if (provisionedOrgId) {
            setActiveOrgId(provisionedOrgId);
        }
        resetSessionCache();
        return payload;
    },

    async completeOnboarding(): Promise<any> {
        const authHeaders = await withClerkAuthorization(
            withCsrfHeader('POST', { 'Content-Type': 'application/json' }),
        );
        const res = await apiFetch(`${BASE_URL}/auth/onboarding/complete`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'include',
            body: JSON.stringify({}),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to complete onboarding');
        }

        const payload = await res.json();
        resetSessionCache();
        return payload;
    },
};
