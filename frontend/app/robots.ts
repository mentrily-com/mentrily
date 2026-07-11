import type { MetadataRoute } from 'next';
import { siteConfig } from './config/site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/dashboard/',
                '/exam/',
                '/api/',
                '/logout',
                '/login',
                '/signup',
                '/sign-in',
                '/sign-up',
                '/forgot-password',
                '/playground',
            ],
        },
        sitemap: `${siteConfig.url}/sitemap.xml`,
        host: siteConfig.url,
    };
}
