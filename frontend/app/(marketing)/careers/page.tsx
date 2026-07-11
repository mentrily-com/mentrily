import type { Metadata } from 'next';
import CareersPage from './careersClient';

export const metadata: Metadata = {
    title: 'Careers',
    description:
        'Join the Mentrily team and help build the platform educators use to teach, test, and certify learners worldwide.',
    alternates: {
        canonical: '/careers',
    },
    openGraph: {
        title: 'Careers',
        description:
            'Join the Mentrily team and help build the platform educators use to teach, test, and certify learners worldwide.',
        url: '/careers',
    },
};

export default function Page() {
    return <CareersPage />;
}
