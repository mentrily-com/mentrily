import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlaygroundCore from '@/app/components/Playground/PlaygroundCore';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';
import PythonNotebookPage from '@/app/(app)/playground/pynb/page';
import WebPlaygroundPage from '@/app/(app)/playground/web/page';
import { siteConfig } from '@/app/config/site';
import {
    getPublicPlaygroundFaqs,
    getPublicPlaygroundSeoEntry,
    publicPlaygroundSeoEntries,
} from '@/app/(app)/playground/publicSeo';
import { PublicSeoContent, PublicSeoHeader } from '@/app/components/Playground/PublicSeoContent';

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

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: getPublicPlaygroundFaqs(entry).map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
            { '@type': 'ListItem', position: 2, name: 'Online Compilers', item: `${siteConfig.url}/online-compilers` },
            { '@type': 'ListItem', position: 3, name: entry.h1, item: `${siteConfig.url}/${entry.slug}` },
        ],
    };

    return (
        <PublicPlaygroundShell
            seoHeader={<PublicSeoHeader entry={entry} />}
            seoContent={<PublicSeoContent entry={entry} />}
        >
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            {entry.kind === 'code' && <PlaygroundCore initialLangId={entry.langId} publicMode />}
            {entry.kind === 'web' && <WebPlaygroundPage embeddedShell={false} />}
            {entry.kind === 'notebook' && <PythonNotebookPage embeddedShell={false} />}
        </PublicPlaygroundShell>
    );
}
