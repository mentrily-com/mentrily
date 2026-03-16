import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BASE_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(request, params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(request, params);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(request, params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(request, params);
}

async function handleRequest(request: NextRequest, params: Promise<{ path: string[] }>) {
    const { path } = await params;
    const pathString = path.join('/');
    const normalizedPath = pathString.replace(/^\/+/, '');

    if (!normalizedPath || normalizedPath.includes('..')) {
        return NextResponse.json({ message: 'Invalid API Path' }, { status: 400 });
    }

    const allowedPrefixes = [
        'auth/',
        'student/',
        'teacher/',
        'admin/',
        'super-admin/',
        'exam/',
        'submission/',
        'code/',
        'course/',
        'organization/',
        'monitoring/'
    ];

    const isAllowed = allowedPrefixes.some((prefix) => normalizedPath === prefix.slice(0, -1) || normalizedPath.startsWith(prefix));
    if (!isAllowed) {
        return NextResponse.json({ message: 'Path not allowed' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    console.log(`[Proxy] Request to /${pathString}`);

    const headers: HeadersInit = {};

    // Forward the Content-Type header if present (important for multipart/form-data)
    const contentType = request.headers.get('content-type');
    if (contentType) {
        headers['Content-Type'] = contentType;
    }

    // Forward custom headers needed by specific endpoints
    const fileSize = request.headers.get('x-file-size');
    if (fileSize) {
        headers['x-file-size'] = fileSize;
    }

    const userAgent = request.headers.get('user-agent');
    if (userAgent) {
        headers['user-agent'] = userAgent;
    }

    const clientPlatform = request.headers.get('x-client-platform');
    if (clientPlatform) {
        headers['x-client-platform'] = clientPlatform;
    }

    const tenantHost = request.headers.get('x-tenant-host') || request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (tenantHost) {
        headers['x-tenant-host'] = tenantHost;
    }

    const orgSubdomain = request.headers.get('x-org-subdomain');
    if (orgSubdomain) {
        headers['x-org-subdomain'] = orgSubdomain;
    }

    const orgDomain = request.headers.get('x-org-domain');
    if (orgDomain) {
        headers['x-org-domain'] = orgDomain;
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = new URL(`${BASE_URL}/${normalizedPath}${request.nextUrl.search}`);
    console.log(`[Proxy] Forwarding to: ${url.href}`);

    if (!url.href.startsWith(`${BASE_URL}/`) && url.href !== BASE_URL) {
        return NextResponse.json({ message: 'Invalid API Path' }, { status: 400 });
    }

    // Use request.body as a stream to avoid loading large files into memory
    const body = (request.method !== 'GET' && request.method !== 'HEAD')
        ? request.body
        : undefined;

    // Next.js Route Handlers have a default body size limit that can be bypassed 
    // by not consuming the body as JSON/Text, but streaming it.
    // However, some fetch implementations require 'duplex: "half"' for streaming bodies.
    const fetchOptions: any = {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        // @ts-ignore - duplex is required for streaming bodies in some environments
        duplex: body ? 'half' : undefined
    };

    try {
        const controller = new AbortController();
        const timeoutMs = 30000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url.href, {
            ...fetchOptions,
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // Filter headers to avoid Content-Encoding issues since fetch auto-decompresses
        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');

        // Forward response
        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('API Proxy Error:', error);
        return NextResponse.json({ message: 'Upstream request failed' }, { status: 502 });
    }
}
