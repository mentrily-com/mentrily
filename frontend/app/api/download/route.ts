import { NextRequest, NextResponse } from 'next/server';
import { siteConfig } from '@/app/config/site';

const ALLOWED_DOWNLOAD_HOSTS = [
    new URL(process.env.NEXT_PUBLIC_MEDIA_CDN_URL || 'https://dyp4wnn9yf27t.cloudfront.net').hostname,
    siteConfig.domain,
    `www.${siteConfig.domain}`,
    ...(process.env.NEXT_PUBLIC_DOWNLOAD_HOSTS || '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
];

function isAllowedDownloadUrl(inputUrl: string): boolean {
    try {
        const parsed = new URL(inputUrl);
        if (process.env.NODE_ENV === 'production') {
            if (parsed.protocol !== 'https:') return false;
        } else {
            if (!['https:', 'http:'].includes(parsed.protocol)) return false;
        }

        const host = parsed.hostname.toLowerCase();
        return ALLOWED_DOWNLOAD_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const name = req.nextUrl.searchParams.get('name') || 'download';

    if (!url) {
        return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
    }

    if (!isAllowedDownloadUrl(url)) {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    try {
        const res = await fetch(url, { redirect: 'error' });
        if (!res.ok || !res.body) {
            return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 });
        }

        const headers = new Headers();
        headers.set('Content-Type', res.headers.get('content-type') || 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
        if (res.headers.get('content-length')) {
            headers.set('Content-Length', res.headers.get('content-length')!);
        }

        // Stream instead of res.blob(): files can be up to 500MB.
        return new NextResponse(res.body, { status: 200, headers });
    } catch {
        return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
}
