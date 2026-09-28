import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import localFont from 'next/font/local';
import './globals.css';
import { siteConfig } from './config/site';

const fraunces = localFont({
    src: [
        {
            path: '../public/fonts/Fraunces-Variable.ttf',
            style: 'normal',
        },
        {
            path: '../public/fonts/Fraunces-Italic-Variable.ttf',
            style: 'italic',
        },
    ],
    variable: '--font-fraunces',
    display: 'swap',
});

export const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: {
        default: `${siteConfig.name} | ${siteConfig.slogan}`,
        template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    manifest: '/manifest.json',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
            { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
        ],
        shortcut: '/favicon.ico',
        apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: siteConfig.name,
    },
    openGraph: {
        type: 'website',
        url: siteConfig.url,
        siteName: siteConfig.name,
        title: `${siteConfig.name} | ${siteConfig.slogan}`,
        description: siteConfig.description,
        images: [
            {
                url: '/brand/og-image.png',
                width: 1200,
                height: 630,
                alt: `${siteConfig.name} brand preview`,
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: `${siteConfig.name} | ${siteConfig.slogan}`,
        description: siteConfig.description,
        images: ['/brand/og-image.png'],
    },
    verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <style>{`
          :root {
            --brand: #007c85;
            --brand-light: #eefbfc;
            --brand-lighter: #d8f5f7;
            --brand-dark: #006a72;
          }
        `}</style>
            </head>
            <body
                className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} font-sans antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
