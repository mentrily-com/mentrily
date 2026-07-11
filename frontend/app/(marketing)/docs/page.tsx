import type { Metadata } from 'next';
import DocsPage from './docsClient';

export const metadata: Metadata = {
    title: 'API Documentation',
    description:
        'Explore the Mentrily API documentation for integrating courses, exams, and learner data into your own tools.',
    alternates: {
        canonical: '/docs',
    },
    openGraph: {
        title: 'API Documentation',
        description:
            'Explore the Mentrily API documentation for integrating courses, exams, and learner data into your own tools.',
        url: '/docs',
    },
};

export default function Page() {
    return <DocsPage />;
}
