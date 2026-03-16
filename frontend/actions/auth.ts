'use server'

import { cookies } from 'next/headers';
import { headers as nextHeaders } from 'next/headers';
import { randomUUID } from 'crypto';
import { getCookieDomain } from '@/lib/domain';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const IS_LOCAL_BASE_URL = /localhost|127\.0\.0\.1/.test(BASE_URL);
const USE_SECURE_COOKIE = process.env.NODE_ENV === 'production' && !IS_LOCAL_BASE_URL;

export async function loginAction(email: string, password: string) {
    try {
        const incomingHeaders = await nextHeaders();
        const requestHost = incomingHeaders.get('x-forwarded-host') || incomingHeaders.get('host');
        const cookieDomain = getCookieDomain(requestHost);

        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Login failed');
        }

        const data = await res.json();
        
        if (data.access_token) {
            const csrfToken = randomUUID();
            const orgSlug = data?.primaryOrganization?.slug;

            await (await cookies()).set('auth_token', data.access_token, {
                httpOnly: true,
                secure: USE_SECURE_COOKIE,
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60,
                priority: 'high',
                ...(cookieDomain ? { domain: cookieDomain } : {})
            });

            await (await cookies()).set('csrf_token', csrfToken, {
                httpOnly: false,
                secure: USE_SECURE_COOKIE,
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60,
                priority: 'high',
                ...(cookieDomain ? { domain: cookieDomain } : {})
            });

            if (orgSlug) {
                await (await cookies()).set('org_subdomain', orgSlug, {
                    httpOnly: false,
                    secure: USE_SECURE_COOKIE,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60,
                    priority: 'high',
                    ...(cookieDomain ? { domain: cookieDomain } : {})
                });
            }
        }
        
        return {
            success: true,
            user: data.user,
            postLoginUrl: data.postLoginUrl,
            primaryOrganization: data.primaryOrganization
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function logoutAction() {
    const incomingHeaders = await nextHeaders();
    const requestHost = incomingHeaders.get('x-forwarded-host') || incomingHeaders.get('host');
    const cookieDomain = getCookieDomain(requestHost);

    const cookieStore = await cookies();

    for (const key of ['auth_token', 'csrf_token', 'org_subdomain']) {
        cookieStore.delete(key);
        if (cookieDomain) {
            cookieStore.set(key, '', {
                httpOnly: key === 'auth_token',
                secure: USE_SECURE_COOKIE,
                sameSite: 'lax',
                path: '/',
                maxAge: 0,
                domain: cookieDomain,
            });
        }
    }

    return { success: true };
}

export async function getAuthToken() {
    return (await cookies()).get('auth_token')?.value;
}
