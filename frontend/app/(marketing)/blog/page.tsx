import type { Metadata } from 'next';
import BlogPage from './blogClient';

export const metadata: Metadata = {
    title: 'Blog',
    description:
        'Product updates, teaching tips, and engineering notes from the Mentrily team.',
    alternates: {
        canonical: '/blog',
    },
    openGraph: {
        title: 'Blog',
        description:
            'Product updates, teaching tips, and engineering notes from the Mentrily team.',
        url: '/blog',
    },
};

export default function Page() {
    return <BlogPage />;
}
