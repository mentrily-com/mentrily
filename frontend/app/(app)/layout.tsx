import { cookies, headers } from 'next/headers';
import { ClerkProvider } from '@clerk/nextjs';
import NextTopLoader from 'nextjs-toploader';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { siteConfig } from '../config/site';
import { ToastProvider } from '../components/Common/Toast';
import { OrganizationProvider } from '../context/OrganizationContext';
import ClerkTokenBridge from '../components/ClerkTokenBridge';
import PostHogProvider from '../components/PostHogProvider';
import ApolloProvider from '../components/ApolloProvider';
import UserTelemetryBridge from '../components/UserTelemetryBridge';
import PWARegister from '../components/PWARegister';
import QueryProvider from '../components/QueryProvider';
import AppShell from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/toaster';

type InitialOrgBranding = {
    name: string;
    logo: string | null;
    primaryColor: string;
    domain: string;
} | null;

type InitialSessionHint = {
    userId: string;
    orgId: string;
    role: string;
};

function normalizeHost(value?: string | null): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/:\d+$/, '');
}

function resolveSubdomain(host: string, rootDomain: string): string {
    if (!host) return '';

    if (host === 'localhost' || host.endsWith('.localhost')) {
        const localParts = host.split('.');
        if (localParts.length > 1) {
            return localParts[0] || '';
        }
        return '';
    }

    if (!rootDomain || !host.endsWith(`.${rootDomain}`)) {
        return '';
    }

    const prefix = host.slice(0, -`.${rootDomain}`.length);
    if (!prefix) return '';

    return prefix.split('.')[0] || '';
}

async function getInitialOrganization(): Promise<InitialOrgBranding> {
    const headerStore = await headers();
    const cookieStore = await cookies();

    const rootDomain = normalizeHost(siteConfig.domain);
    const host = normalizeHost(headerStore.get('x-forwarded-host') || headerStore.get('host'));

    let subdomain = resolveSubdomain(host, rootDomain);

    if (!subdomain && host === 'localhost') {
        subdomain = String(cookieStore.get('org_subdomain')?.value || '').toLowerCase();
    }

    if (!subdomain || ['www', 'app', 'api', 'admin'].includes(subdomain)) {
        return null;
    }

    const headerDomain = normalizeHost(headerStore.get('x-org-domain'));
    const headerName = String(headerStore.get('x-org-name') || '').trim();
    const headerLogo = String(headerStore.get('x-org-logo') || '').trim();
    const headerPrimaryColor = String(headerStore.get('x-org-primary-color') || '').trim();

    if (headerDomain) {
        return {
            name: headerName || subdomain,
            logo: headerLogo || null,
            primaryColor: headerPrimaryColor || '#008D98',
            domain: headerDomain,
        };
    }

    const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(
        /\/$/,
        '',
    );

    try {
        const orgLookupUrl = `${apiBase}/organization/public?domain=${encodeURIComponent(subdomain)}`;
        const res = await fetch(
            orgLookupUrl,
            host === 'localhost'
                ? { cache: 'no-store' }
                : {
                      next: { revalidate: 300 },
                  },
        );

        if (!res.ok) return null;

        const data = await res.json();
        return {
            name: data.name,
            logo: data.logo,
            primaryColor: data.primaryColor || '#008D98',
            domain: data.domain,
        };
    } catch {
        return null;
    }
}

async function getInitialSessionHint(): Promise<InitialSessionHint> {
    const headerStore = await headers();

    return {
        userId: String(headerStore.get('x-session-user-id') || '').trim(),
        orgId: String(headerStore.get('x-session-org-id') || '').trim(),
        role: String(headerStore.get('x-session-role') || '')
            .trim()
            .toUpperCase(),
    };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const initialOrganization = await getInitialOrganization();
    const initialSessionHint = await getInitialSessionHint();
    const initialBrand = initialOrganization?.primaryColor || '#008D98';

    return (
        <>
            <meta name="bc-session-user-id" content={initialSessionHint.userId} />
            <meta name="bc-session-org-id" content={initialSessionHint.orgId} />
            <meta name="bc-session-role" content={initialSessionHint.role} />
            <style>{`
          :root {
            --brand: ${initialBrand};
            --brand-light: ${initialBrand}20;
            --brand-lighter: ${initialBrand}08;
            --brand-dark: ${initialBrand};
          }
        `}</style>
            <ClerkProvider signInUrl="/login" signUpUrl="/signup">
                <PostHogProvider>
                    <ClerkTokenBridge />
                    <UserTelemetryBridge />
                    <PWARegister />
                    <NextTopLoader color="#008D98" showSpinner={false} speed={400} />
                    <ApolloProvider>
                        <QueryProvider>
                            <OrganizationProvider initialOrganization={initialOrganization}>
                                <ToastProvider>
                                    <AppShell>{children}</AppShell>
                                    <Toaster />
                                </ToastProvider>
                            </OrganizationProvider>
                        </QueryProvider>
                    </ApolloProvider>
                    <Analytics />
                    <SpeedInsights />
                </PostHogProvider>
            </ClerkProvider>
        </>
    );
}
