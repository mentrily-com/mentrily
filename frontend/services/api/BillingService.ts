import { API_BASE_URL } from '@/lib/api-base';
import { withCsrfHeader } from '@/lib/csrf';
import { withClerkAuthorization } from '@/lib/clerk-token';

const BASE_URL = API_BASE_URL;

async function handleResponse(res: Response) {
    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Billing request failed');
    }

    return res.json();
}

export const BillingService = {
    async getPlans() {
        const res = await fetch(`${BASE_URL}/billing/plans`, {
            method: 'GET',
            credentials: 'include',
        });

        return handleResponse(res);
    },

    async getUsage() {
        const headers = await withClerkAuthorization({ 'Content-Type': 'application/json' });
        const res = await fetch(`${BASE_URL}/billing/usage`, {
            method: 'GET',
            headers,
            credentials: 'include',
        });

        return handleResponse(res);
    },

    async createCheckoutSession(payload: { priceId: string; successUrl?: string; cancelUrl?: string }) {
        const headers = await withClerkAuthorization(withCsrfHeader('POST', { 'Content-Type': 'application/json' }));

        const res = await fetch(`${BASE_URL}/billing/checkout-session`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload),
        });

        return handleResponse(res);
    },

    async createPortalSession(payload?: { returnUrl?: string }) {
        const headers = await withClerkAuthorization(withCsrfHeader('POST', { 'Content-Type': 'application/json' }));

        const res = await fetch(`${BASE_URL}/billing/portal-session`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload || {}),
        });

        return handleResponse(res);
    },

    async syncCheckoutSession(sessionId: string) {
        const headers = await withClerkAuthorization(withCsrfHeader('POST', { 'Content-Type': 'application/json' }));

        const res = await fetch(`${BASE_URL}/billing/sync-checkout-session`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ sessionId }),
        });

        return handleResponse(res);
    },
};
