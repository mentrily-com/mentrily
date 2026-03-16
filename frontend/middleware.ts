import { NextRequest, NextResponse } from 'next/server';
import { parseSubdomain } from '@/lib/domain';

const API_BASE = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

async function resolveOrganization(subdomain: string) {
  try {
    const response = await fetch(`${API_BASE}/organization/public?domain=${encodeURIComponent(subdomain)}`, {
      cache: 'no-store',
      headers: {
        'x-middleware-org-lookup': '1'
      }
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

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

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

  if (!subdomain) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  requestHeaders.set('x-org-subdomain', subdomain);

  const org = await resolveOrganization(subdomain);
  if (org?.domain) {
    requestHeaders.set('x-org-domain', String(org.domain).toLowerCase());
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
