import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

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

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'nyc3.digitaloceanspaces.com',
            },
            {
                protocol: 'https',
                hostname: '**.digitaloceanspaces.com',
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
