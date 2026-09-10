import type { Metadata } from 'next';
import Link from 'next/link';
import { publicPlaygroundSeoEntries } from '@/app/(app)/playground/publicSeo';
import { siteConfig } from '@/app/config/site';

export const metadata: Metadata = {
    title: 'Free Online Compilers & Code Playgrounds — 30+ Languages',
    description:
        'Write, compile, and run code online for free in 30+ languages — C, C++, Python, Java, JavaScript, Go, Rust, and more. No installation or signup required.',
    alternates: {
        canonical: '/online-compilers',
    },
    openGraph: {
        title: 'Free Online Compilers & Code Playgrounds — 30+ Languages',
        description:
            'Write, compile, and run code online for free in 30+ languages — C, C++, Python, Java, JavaScript, Go, Rust, and more.',
        url: '/online-compilers',
    },
};

export default function OnlineCompilersPage() {
    const codeEntries = publicPlaygroundSeoEntries.filter((entry) => entry.kind === 'code');
    const toolEntries = publicPlaygroundSeoEntries.filter((entry) => entry.kind !== 'code');

    const itemListJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Free Online Compilers & Code Playgrounds',
        itemListElement: publicPlaygroundSeoEntries.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.h1,
            url: `${siteConfig.url}/${entry.slug}`,
        })),
    };

    return (
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Free Online Compilers &amp; Code Playgrounds
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Write, compile, and run code directly in your browser — no installation, no configuration, and no
                account required. Every playground runs your program in a secure cloud sandbox with standard input
                support, so it behaves just like a local terminal.
            </p>

            <h2 className="mt-10 text-xl font-black tracking-tight text-slate-950">Programming languages</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                {codeEntries.map((entry) => (
                    <li key={entry.slug}>
                        <Link
                            href={`/${entry.slug}`}
                            className="text-sm font-semibold text-[var(--brand)] hover:underline"
                        >
                            {entry.label} Compiler
                        </Link>
                    </li>
                ))}
            </ul>

            <h2 className="mt-10 text-xl font-black tracking-tight text-slate-950">Web &amp; data tools</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                {toolEntries.map((entry) => (
                    <li key={entry.slug}>
                        <Link
                            href={`/${entry.slug}`}
                            className="text-sm font-semibold text-[var(--brand)] hover:underline"
                        >
                            {entry.h1.replace(/^Online /, '')}
                        </Link>
                    </li>
                ))}
            </ul>

            <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-lg font-black tracking-tight text-slate-950">Built for teaching, too</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    These playgrounds are powered by the same execution engine Mentrily educators use for auto-graded
                    coding questions in courses and proctored exams. Create a free account to build your own coding
                    course, share practice problems, and track learner progress.
                </p>
                <Link
                    href="/signup"
                    className="mt-4 inline-flex items-center rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-black text-white hover:opacity-90"
                >
                    Start free
                </Link>
            </div>
        </div>
    );
}
