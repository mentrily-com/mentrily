'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { parseSubdomain } from '@/lib/domain';
import { API_BASE_URL } from '@/lib/api-base';

interface OrganizationBranding {
    name: string;
    logo: string | null;
    primaryColor: string;
    domain: string;
    subdomain?: string;
}

interface OrganizationContextType {
    organization: OrganizationBranding | null;
    loading: boolean;
}

function getLocalCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const raw =
        document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
            ?.split('=')[1] || '';
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function resolveLocalSubdomain(): string {
    if (typeof window === 'undefined') return '';

    const hostname = window.location.hostname;
    let subdomain = '';

    const params = new URLSearchParams(window.location.search);
    const orgParam = params.get('org');

    if (orgParam) {
        subdomain = orgParam;
        if (hostname.includes('localhost')) {
            localStorage.setItem('local_org_simulation', orgParam);
            document.cookie = `org_subdomain=${encodeURIComponent(orgParam)}; path=/; max-age=${7 * 24 * 60 * 60}`;
        }
        return subdomain;
    }

    subdomain = parseSubdomain(hostname) || '';
    if (!subdomain && hostname.includes('localhost')) {
        subdomain = localStorage.getItem('local_org_simulation') || getLocalCookie('org_subdomain') || '';
    }

    return subdomain;
}

function getCachedOrganization(subdomain: string): OrganizationBranding | null {
    if (!subdomain || typeof window === 'undefined') return null;

    const localCache = localStorage.getItem(`org_cache_${subdomain}`);
    if (!localCache) return null;

    try {
        const { data, timestamp } = JSON.parse(localCache);
        if (Date.now() - timestamp < 3600 * 1000) {
            return data as OrganizationBranding;
        }
        localStorage.removeItem(`org_cache_${subdomain}`);
        return null;
    } catch {
        localStorage.removeItem(`org_cache_${subdomain}`);
        return null;
    }
}

const OrganizationContext = createContext<OrganizationContextType>({
    organization: null,
    loading: true,
});

export const useOrganization = () => useContext(OrganizationContext);

export function OrganizationProvider({
    children,
    initialOrganization = null,
}: {
    children: React.ReactNode;
    initialOrganization?: OrganizationBranding | null;
}) {
    const initialSubdomain = typeof window !== 'undefined' ? resolveLocalSubdomain() : '';
    const clientCachedOrganization = initialSubdomain ? getCachedOrganization(initialSubdomain) : null;
    const resolvedInitialOrganization = initialOrganization || clientCachedOrganization;

    const [organization, setOrganization] = useState<OrganizationBranding | null>(resolvedInitialOrganization);
    const [loading, setLoading] = useState(Boolean(initialSubdomain && !resolvedInitialOrganization));

    useEffect(() => {
        if (organization) {
            injectBrandColors(organization);
        }
    }, [organization]);

    useEffect(() => {
        const fetchOrgBranding = async () => {
            const subdomain = resolveLocalSubdomain();

            if (!subdomain || ['www', 'app', 'api', 'admin'].includes(subdomain)) {
                setLoading(false);
                return;
            }

            // initialOrganization.domain can be the org's full custom/root
            // domain (e.g. "acme.mentrily.com"), not the bare subdomain
            // prefix ("acme") resolved here client-side -- comparing those
            // two directly was always false for real org tenants, so this
            // guard never actually skipped the redundant fetch below. The
            // server also hands back the exact subdomain it resolved
            // (`subdomain`), which is what's comparable to this value.
            if (initialOrganization && (initialOrganization.subdomain || initialOrganization.domain) === subdomain) {
                setOrganization(initialOrganization);
                setLoading(false);
                return;
            }

            const cachedOrg = getCachedOrganization(subdomain);
            if (cachedOrg) {
                setOrganization(cachedOrg);
                setLoading(false);
                injectBrandColors(cachedOrg);
                return;
            }

            setLoading(true);

            try {
                const res = await fetch(`${API_BASE_URL}/organization/public?domain=${encodeURIComponent(subdomain)}`);
                if (res.ok) {
                    const data = await res.json();
                    const orgData = {
                        name: data.name,
                        logo: data.logo,
                        primaryColor: data.primaryColor || '#008D98',
                        domain: data.domain,
                    };
                    setOrganization(orgData);

                    localStorage.setItem(
                        `org_cache_${subdomain}`,
                        JSON.stringify({
                            data: orgData,
                            timestamp: Date.now(),
                        }),
                    );

                    injectBrandColors(orgData);
                }
            } catch (error) {
                console.error('Failed to load organization branding', error);
            }
            setLoading(false);
        };

        fetchOrgBranding();
    }, [initialOrganization]);

    const injectBrandColors = (data: OrganizationBranding) => {
        if (data.primaryColor) {
            const color = data.primaryColor;
            document.documentElement.style.setProperty('--brand', color);
            document.documentElement.style.setProperty('--brand-light', color + '20');
            document.documentElement.style.setProperty('--brand-lighter', color + '08');
            document.documentElement.style.setProperty('--brand-dark', color);
        }
    };

    return <OrganizationContext.Provider value={{ organization, loading }}>{children}</OrganizationContext.Provider>;
}
