import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { siteConfig } from '../config/site';

const fraunces = Fraunces({
    subsets: ['latin'],
    variable: '--font-display',
    display: 'swap',
    axes: ['opsz', 'SOFT', 'WONK'],
});

const dmSans = DM_Sans({
    subsets: ['latin'],
    variable: '--font-body',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-code',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        absolute: `${siteConfig.name} | ${siteConfig.slogan}`,
        template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
            style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
        >
            <Navbar />
            <main>{children}</main>
            <Footer />
        </div>
    );
}
