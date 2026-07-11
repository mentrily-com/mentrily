import type { Metadata } from 'next';
import PartnershipPage from './partnershipClient';

export const metadata: Metadata = {
    title: 'Partnerships',
    description:
        'Partner with Mentrily to bring branded online learning, exams, and certification to your institution or community.',
    alternates: {
        canonical: '/partnership',
    },
    openGraph: {
        title: 'Partnerships',
        description:
            'Partner with Mentrily to bring branded online learning, exams, and certification to your institution or community.',
        url: '/partnership',
    },
};

export default function Page() {
    return <PartnershipPage />;
}
