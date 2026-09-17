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
                // App surface (and private /chat?c=… conversations); /ai is the indexable page.
                '/chat',
            ],
        },
        sitemap: `${siteConfig.url}/sitemap.xml`,
        host: siteConfig.url,
    };
}
