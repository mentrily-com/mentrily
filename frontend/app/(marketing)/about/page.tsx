import type { Metadata } from 'next';
import AboutPage from './aboutClient';

export const metadata: Metadata = {
    title: 'About Us',
    description:
        'Learn about Mentrily, the platform that helps educators launch branded learning platforms with courses, exams, coding practice, and certificates in one place.',
    alternates: {
        canonical: '/about',
    },
    openGraph: {
        title: 'About Us',
        description:
            'Learn about Mentrily, the platform that helps educators launch branded learning platforms with courses, exams, coding practice, and certificates in one place.',
        url: '/about',
    },
};

export default function Page() {
    return <AboutPage />;
}
