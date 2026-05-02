import { MonitoringEvent, ViolationEvent } from '@/types/monitoring';
import { API_BASE_URL } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';

const BASE_URL = API_BASE_URL;

// Helper for auth fetch
const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = withCsrfHeader(options.method, {
        'Content-Type': 'application/json',
        ...((options.headers || {}) as any),
    });
    const authHeaders = await withClerkAuthorization(headers);

    return fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: authHeaders,
    });
};

export const MonitoringService = {
    async logEvent(event: MonitoringEvent): Promise<void> {
        try {
            if (typeof window !== 'undefined' && (window as any).api) {
                // Electron Bridge
                (window as any).api.sendToMain('log-event', event);
            }

            const response = await authFetch(`/exam/monitoring/log-event`, {
                method: 'POST',
                body: JSON.stringify(event),
            });

            if (!response.ok) throw new Error('Failed to log event');
        } catch (error) {
            console.warn('[MonitoringService] Log Event failed (running offline/fallback):', error);
        }
    },

    async logViolation(violation: ViolationEvent): Promise<void> {
        try {
            if (typeof window !== 'undefined' && (window as any).api) {
                (window as any).api.sendToMain('log-violation', violation);
            }

            const response = await authFetch(`/exam/monitoring/log-violation`, {
                method: 'POST',
                body: JSON.stringify(violation),
            });

            if (!response.ok) throw new Error('Failed to log violation');
        } catch (error) {
            console.error('[MonitoringService] Log Violation failed:', error);
        }
    },

    async sendHeartbeat(): Promise<void> {
        try {
            const response = await authFetch(`/exam/monitoring/heartbeat`, {
                method: 'POST',
                body: JSON.stringify({ deviceId: 'browser' }),
            });
            if (!response.ok) throw new Error('Heartbeat failed');
        } catch (error) {
            // Silent fail for heartbeat in dev/offline mode
        }
    },

    async checkHealth(): Promise<boolean> {
        try {
            const res = await fetch(`${BASE_URL}/exam/isDOUp`);
            const data = await res.json();
            return data.status === 'up';
        } catch (e) {
            console.warn('[MonitoringService] Health check failed, assuming offline mode.');
            return true; // Assume up to prevent blocking user in dev
        }
    },
};
