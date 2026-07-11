import type { Metadata } from 'next';
import ContactPage from './contactClient';

export const metadata: Metadata = {
    title: 'Contact Us',
    description:
        'Get in touch with the Mentrily team for support, sales, partnerships, or general questions. We usually reply within one business day.',
    alternates: {
        canonical: '/contact',
    },
    openGraph: {
        title: 'Contact Us',
        description:
            'Get in touch with the Mentrily team for support, sales, partnerships, or general questions. We usually reply within one business day.',
        url: '/contact',
    },
};

export default function Page() {
    return <ContactPage />;
}
