import type { Metadata } from 'next';
import StatusPage from './statusClient';

export const metadata: Metadata = {
    title: 'System Status',
    description:
        'Live operational status of Mentrily services, including the web app, exam delivery, and code execution.',
    alternates: {
        canonical: '/status',
    },
    openGraph: {
        title: 'System Status',
        description:
            'Live operational status of Mentrily services, including the web app, exam delivery, and code execution.',
        url: '/status',
    },
};

export default function Page() {
    return <StatusPage />;
}
