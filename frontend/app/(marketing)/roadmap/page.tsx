import type { Metadata } from 'next';
import RoadmapPage from './roadmapClient';

export const metadata: Metadata = {
    title: 'Roadmap',
    description:
        'See what the Mentrily team is building next: upcoming features for course authoring, exams, proctoring, and the coding playground.',
    alternates: {
        canonical: '/roadmap',
    },
    openGraph: {
        title: 'Roadmap',
        description:
            'See what the Mentrily team is building next: upcoming features for course authoring, exams, proctoring, and the coding playground.',
        url: '/roadmap',
    },
};

export default function Page() {
    return <RoadmapPage />;
}
