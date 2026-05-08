import type { Metadata } from 'next';
import { Geist, Geist_Mono, DM_Sans, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { siteConfig } from './config/site';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

const dmSans = DM_Sans({
    variable: '--font-dm-sans',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

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

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: {
        default: `${siteConfig.name} | ${siteConfig.slogan}`,
        template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    alternates: {
        canonical: '/',
    },
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
            --brand: #008D98;
            --brand-light: #008D9820;
            --brand-lighter: #008D9808;
            --brand-dark: #008D98;
          }
        `}</style>
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
