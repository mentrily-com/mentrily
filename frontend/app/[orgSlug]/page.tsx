import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlaygroundCore from '@/app/components/Playground/PlaygroundCore';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import PythonNotebookPage from '@/app/playground/pynb/page';
import WebPlaygroundPage from '@/app/playground/web/page';
import { siteConfig } from '@/app/config/site';
import {
    getPublicPlaygroundSeoEntry,
    publicPlaygroundSeoEntries,
} from '@/app/playground/publicSeo';

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

export function generateStaticParams() {
    return publicPlaygroundSeoEntries.map((entry) => ({
        orgSlug: entry.slug,
    }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { orgSlug } = await params;
    const entry = getPublicPlaygroundSeoEntry(orgSlug);
    if (!entry) return {};

    return {
        title: entry.title,
        description: entry.description,
        keywords: entry.keywords,
        alternates: {
            canonical: `/${entry.slug}`,
        },
        openGraph: {
            type: 'website',
            url: `${siteConfig.url}/${entry.slug}`,
            title: entry.title,
            description: entry.description,
            siteName: siteConfig.name,
            images: ['/brand/og-image.png'],
        },
        twitter: {
            card: 'summary_large_image',
            title: entry.title,
            description: entry.description,
            images: ['/brand/og-image.png'],
        },
    };
}

export default async function PublicPlaygroundPage({ params }: PageProps) {
    const { orgSlug } = await params;
    const entry = getPublicPlaygroundSeoEntry(orgSlug);
    if (!entry) notFound();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: entry.h1,
        url: `${siteConfig.url}/${entry.slug}`,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        description: entry.description,
    };

    return (
        <PublicPlaygroundShell>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            {entry.kind === 'code' && <PlaygroundCore initialLangId={entry.langId} publicMode />}
            {entry.kind === 'web' && <WebPlaygroundPage />}
            {entry.kind === 'notebook' && <PythonNotebookPage />}
        </PublicPlaygroundShell>
    );
}
