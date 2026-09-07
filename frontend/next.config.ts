import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const mediaCdnHostname = new URL(process.env.NEXT_PUBLIC_MEDIA_CDN_URL || 'https://dyp4wnn9yf27t.cloudfront.net')
    .hostname;

const nextConfig: NextConfig = {
    output: 'standalone',
    compress: true,
    poweredByHeader: false,
    reactStrictMode: false, // Performance: Disable in production to avoid double-renders
    async redirects() {
        return [
            {
                source: '/dashboard/student',
                destination: '/dashboard/learner',
                permanent: true,
            },
            {
                source: '/dashboard/student/:path*',
                destination: '/dashboard/learner/:path*',
                permanent: true,
            },
            {
                source: '/dashboard/teacher',
                destination: '/dashboard/creator',
                permanent: true,
            },
            {
                source: '/dashboard/teacher/:path*',
                destination: '/dashboard/creator/:path*',
                permanent: true,
            },
            {
                source: '/dashboard/studio',
                destination: '/dashboard/creator',
                permanent: true,
            },
            {
                source: '/dashboard/studio/:path*',
                destination: '/dashboard/creator/:path*',
                permanent: true,
            },
            {
                source: '/dashboard/admin',
                destination: '/dashboard/creator',
                permanent: true,
            },
            {
                source: '/dashboard/admin/:path*',
                destination: '/dashboard/creator/:path*',
                permanent: true,
            },
            {
                source: '/dashboard/creater',
                destination: '/dashboard/creator',
                permanent: true,
            },
            {
                source: '/dashboard/creater/:path*',
                destination: '/dashboard/creator/:path*',
                permanent: true,
            },
        ];
    },

    // Proxy PostHog through our own domain so ad-blockers cannot intercept it.
    // Requests to /ingest/* are rewritten server-side to us.i.posthog.com.
    async rewrites() {
        return [
            {
                source: '/ingest/static/:path*',
                destination: 'https://us-assets.i.posthog.com/static/:path*',
            },
            {
                source: '/ingest/decide',
                destination: 'https://us.i.posthog.com/decide',
            },
            {
                source: '/ingest/:path*',
                destination: 'https://us.i.posthog.com/:path*',
            },
        ];
    },

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: mediaCdnHostname,
            },
            {
                protocol: 'https',
                hostname: 'img.clerk.com',
            },
            {
                protocol: 'https',
                hostname: 'images.clerk.dev',
            },
        ],
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
    },

    experimental: {
        optimizeCss: true,
        // Tree-shake heavy barrel-file packages so pages only bundle the
        // components they actually import (lucide-react is covered by the
        // built-in default list).
        optimizePackageImports: ['framer-motion', 'recharts', '@apollo/client'],
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default withSentryConfig(nextConfig, {
    silent: true,
    disableLogger: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
});
