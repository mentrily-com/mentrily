import type { MetadataRoute } from 'next';
import { siteConfig } from './config/site';

const marketingRoutes = ['', '/pricing', '/about', '/contact'];

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return marketingRoutes.map((route) => ({
        url: `${siteConfig.url}${route}`,
        lastModified: now,
        changeFrequency: route === '' ? 'weekly' : 'monthly',
        priority: route === '' ? 1 : 0.7,
    }));
}
