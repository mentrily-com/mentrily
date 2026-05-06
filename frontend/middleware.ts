import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { parseSubdomain } from '@/lib/domain';

const API_BASE = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(
    /\/$/,
    '',
);

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);
const isPublicRoute = createRouteMatcher([
    '/',
    '/about(.*)',
    '/contact(.*)',
    '/pricing(.*)',
    '/login(.*)',
    '/signup(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/exam/login(.*)',
    '/exam/waiting(.*)',
    '/playground(.*)',
    '/certificate(.*)',
    '/api/webhooks/clerk(.*)',
    '/_next(.*)',
]);

async function resolveOrganization(subdomain: string) {
    try {
        const response = await fetch(`${API_BASE}/organization/public?domain=${encodeURIComponent(subdomain)}`, {
            cache: 'no-store',
            headers: {
                'x-middleware-org-lookup': '1',
            },
        });

        if (!response.ok) {
            return null;
        }

        const org = await response.json();
        return org;
    } catch {
        return null;
    }
}

function getStringValue(source: Record<string, unknown> | undefined, key: string): string {
    const value = source?.[key];
    return typeof value === 'string' ? value : '';
}

export default clerkMiddleware(async (auth, request) => {
    const requestHeaders = new Headers(request.headers);
    const invitationStatus = String(request.nextUrl.searchParams.get('__clerk_status') || '')
        .trim()
        .toLowerCase();
    const invitationTicket = String(request.nextUrl.searchParams.get('__clerk_ticket') || '').trim();

    const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
    const hostWithoutPort = host.replace(/:\d+$/, '').toLowerCase();
    const isPlainLocalhost = hostWithoutPort === 'localhost';

    let subdomain = parseSubdomain(hostWithoutPort);

    if (!subdomain && hostWithoutPort.includes('localhost') && !isPlainLocalhost) {
        const fromCookie = request.cookies.get('org_subdomain')?.value;
        if (fromCookie) {
            subdomain = fromCookie.toLowerCase();
        }
    }

    requestHeaders.set('x-tenant-host', hostWithoutPort);

    const authState = await auth();

    const authSnapshot = authState as {
        userId?: string | null;
        orgId?: string | null;
        sessionClaims?: Record<string, unknown>;
    };
    const sessionClaims = authSnapshot.sessionClaims;
    const metadata =
        (sessionClaims?.metadata as Record<string, unknown> | undefined) ||
        (sessionClaims?.public_metadata as Record<string, unknown> | undefined) ||
        (sessionClaims?.unsafe_metadata as Record<string, unknown> | undefined);
    const claimRole =
        getStringValue(sessionClaims, 'role') || getStringValue(metadata, 'role');
    const claimOrgId =
        String(authSnapshot.orgId || '').trim() ||
        getStringValue(sessionClaims, 'org_id') ||
        getStringValue(sessionClaims, 'orgId') ||
        getStringValue(metadata, 'orgId');

    requestHeaders.set('x-session-user-id', String(authState?.userId || ''));
    requestHeaders.set('x-session-org-id', String(claimOrgId || ''));
    requestHeaders.set('x-session-role', String(claimRole || '').toUpperCase());

    if (subdomain) {
        requestHeaders.set('x-org-subdomain', subdomain);

        const org = await resolveOrganization(subdomain);
        if (org?.domain) {
            requestHeaders.set('x-org-domain', String(org.domain).toLowerCase());
            requestHeaders.set('x-org-name', String(org.name || ''));
            requestHeaders.set('x-org-logo', String(org.logo || ''));
            requestHeaders.set('x-org-primary-color', String(org.primaryColor || ''));
        }
    }

    if (!isPublicRoute(request) && isProtectedRoute(request)) {
        if (!authState?.userId) {
            if (invitationTicket && invitationStatus === 'sign_up') {
                const signUpUrl = new URL('/signup', request.url);
                signUpUrl.search = request.nextUrl.search;
                return NextResponse.redirect(signUpUrl);
            }
            const loginUrl = new URL('/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
});

export const config = {
    matcher: [
        '/((?!$|about(?:/.*)?|contact(?:/.*)?|pricing(?:/.*)?|_next/static|_next/image|_next/webpack-hmr|robots.txt|sitemap.xml|manifest.json|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
    ],
};
