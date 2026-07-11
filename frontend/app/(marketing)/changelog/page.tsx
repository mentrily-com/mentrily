import type { Metadata } from 'next';
import ChangelogPage from './changelogClient';

export const metadata: Metadata = {
    title: 'Changelog',
    description:
        'See what is new in Mentrily: feature releases, improvements, and fixes across courses, exams, and the coding playground.',
    alternates: {
        canonical: '/changelog',
    },
    openGraph: {
        title: 'Changelog',
        description:
            'See what is new in Mentrily: feature releases, improvements, and fixes across courses, exams, and the coding playground.',
        url: '/changelog',
    },
};

export default function Page() {
    return <ChangelogPage />;
}
