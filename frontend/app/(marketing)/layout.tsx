import type { Metadata } from 'next';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { siteConfig } from '../config/site';

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
            style={
                {
                    '--font-display': 'var(--font-fraunces)',
                    '--font-body': 'var(--font-dm-sans)',
                    '--font-code': 'var(--font-jetbrains-mono)',
                    fontFamily: 'var(--font-body), system-ui, sans-serif',
                } as React.CSSProperties
            }
        >
            <Navbar />
            <main>{children}</main>
            <Footer />
        </div>
    );
}
