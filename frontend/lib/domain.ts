import { siteConfig } from '@/app/config/site';

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin']);

function normalizeHost(value?: string | null): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/:\d+$/, '');
}

export function getRootDomain(): string {
    return normalizeHost(process.env.NEXT_PUBLIC_APP_DOMAIN || siteConfig.domain);
}

export function getCookieDomain(hostOrUrl?: string | null): string | undefined {
    const host = normalizeHost(hostOrUrl);
    const rootDomain = getRootDomain();

    if (!rootDomain || rootDomain === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(rootDomain)) {
        return undefined;
    }

    if (!host) {
        return `.${rootDomain}`;
    }

    if (host === 'localhost' || host.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        return undefined;
    }

    if (host !== rootDomain && !host.endsWith(`.${rootDomain}`)) {
        return undefined;
    }

    return `.${rootDomain}`;
}

export function parseSubdomain(hostOrUrl?: string | null): string | null {
    const host = normalizeHost(hostOrUrl);
    if (!host) return null;

    if (host === 'localhost' || host.endsWith('.localhost')) {
        const localParts = host.split('.');
        if (localParts.length > 1) {
            const localSub = localParts[0];
            if (!RESERVED_SUBDOMAINS.has(localSub)) return localSub;
        }
        return null;
    }

    const rootDomain = getRootDomain();
    if (!rootDomain) return null;

    if (!host.endsWith(`.${rootDomain}`)) {
        return null;
    }

    const prefix = host.slice(0, -`.${rootDomain}`.length);
    if (!prefix) return null;

    const firstSegment = prefix.split('.')[0];
    if (!firstSegment || RESERVED_SUBDOMAINS.has(firstSegment)) {
        return null;
    }

    return firstSegment;
}

/**
 * The org subdomain this browser tab is currently on, mirroring the
 * resolution OrganizationContext uses: real host subdomain first, then (for
 * localhost simulation) the `local_org_simulation`/`org_subdomain`
 * fallbacks written by the `?org=` param. Null on the apex domain.
 */
export function getCurrentSubdomain(): string | null {
    if (typeof window === 'undefined') return null;

    const hostname = window.location.hostname;
    const fromHost = parseSubdomain(hostname);
    if (fromHost) return fromHost;

    if (hostname.includes('localhost')) {
        const simulated =
            localStorage.getItem('local_org_simulation') ||
            document.cookie
                .split('; ')
                .find((entry) => entry.startsWith('org_subdomain='))
                ?.split('=')[1];
        if (simulated) {
            try {
                return decodeURIComponent(simulated) || null;
            } catch {
                return simulated || null;
            }
        }
    }

    return null;
}

export function buildOrgUrl(subdomain: string, pathname = '/'): string | null {
    const normalizedSubdomain = String(subdomain || '')
        .trim()
        .toLowerCase();
    if (!normalizedSubdomain) return null;

    const rootDomain = getRootDomain();
    if (!rootDomain) return null;

    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;

    if (rootDomain === 'localhost') {
        return `http://${normalizedSubdomain}.localhost:3000${normalizedPath}`;
    }

    return `https://${normalizedSubdomain}.${rootDomain}${normalizedPath}`;
}
