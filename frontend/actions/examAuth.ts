'use server'

import { cookies } from 'next/headers';
import { headers as nextHeaders } from 'next/headers';
import { randomUUID } from 'crypto';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const IS_LOCAL_BASE_URL = /localhost|127\.0\.0\.1/.test(BASE_URL);
const USE_SECURE_COOKIE = process.env.NODE_ENV === 'production' && !IS_LOCAL_BASE_URL;

export async function examLoginAction(email: string, testCode: string, password?: string, slug?: string | null) {
    try {
        const incomingHeaders = await nextHeaders();
        const userAgent = incomingHeaders.get('user-agent') || '';
        const derivedClientPlatform = userAgent.toLowerCase().includes('electron') ? 'electron' : 'web';
        const clientPlatform = incomingHeaders.get('x-client-platform') || derivedClientPlatform;

        const res = await fetch(`${BASE_URL}/auth/exam-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': userAgent,
                'x-client-platform': clientPlatform
            },
            body: JSON.stringify({ email, testCode, password, slug })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Exam login failed');
        }

        const data = await res.json();

        if (data.access_token) {
            const csrfToken = randomUUID();

            await (await cookies()).set('auth_token', data.access_token, {
                httpOnly: true,
                secure: USE_SECURE_COOKIE,
                sameSite: 'lax',
                path: '/',
                maxAge: 24 * 60 * 60,
                priority: 'high'
            });

            await (await cookies()).set('csrf_token', csrfToken, {
                httpOnly: false,
                secure: USE_SECURE_COOKIE,
                sameSite: 'lax',
                path: '/',
                maxAge: 24 * 60 * 60,
                priority: 'high'
            });
        }

        return { success: true, user: data.user, exam: data.exam };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
