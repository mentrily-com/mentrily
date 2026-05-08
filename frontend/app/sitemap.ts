import type { MetadataRoute } from 'next';
import { siteConfig } from './config/site';
import { publicPlaygroundSeoEntries } from './(app)/playground/publicSeo';

const marketingRoutes = ['', '/pricing', '/about', '/contact'];

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    const marketing = marketingRoutes.map((route) => ({
        url: `${siteConfig.url}${route}`,
        lastModified: now,
        changeFrequency: (route === '' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
        priority: route === '' ? 1 : 0.7,
    }));

    const playground = publicPlaygroundSeoEntries.map((entry) => ({
        url: `${siteConfig.url}/${entry.slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }));

    return [...marketing, ...playground];
}
