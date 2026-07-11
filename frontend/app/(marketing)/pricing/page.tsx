import type { Metadata } from 'next';
import PricingPage from './pricingClient';

export const metadata: Metadata = {
    title: 'Pricing',
    description:
        'Simple, transparent pricing for educators. Start free and upgrade for coding questions, proctored exams, certificates, and more.',
    alternates: {
        canonical: '/pricing',
    },
    openGraph: {
        title: 'Pricing',
        description:
            'Simple, transparent pricing for educators. Start free and upgrade for coding questions, proctored exams, certificates, and more.',
        url: '/pricing',
    },
};

export default function Page() {
    return <PricingPage />;
}
