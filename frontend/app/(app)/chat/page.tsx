import type { Metadata } from 'next';
import PublicAiPage from '@/app/components/AiPublic/PublicAiPage';

// The full-screen Mentrily AI chat app. It lives in the (app) group so Clerk
// can tell guests, learners and creators apart. The searchable description
// page is /ai; this app surface (and every /chat?c=… conversation URL) stays
// out of the index.
export const metadata: Metadata = {
    title: 'Chat with Mentrily AI',
    description:
        'Chat with Mentrily AI to plan courses, build exams and write quizzes, then send them straight to your Mentrily builder.',
    robots: { index: false, follow: true },
    openGraph: {
        title: 'Chat with Mentrily AI',
        description:
            'Plan courses, build exams and write quizzes with AI, then send them straight to your Mentrily builder.',
        url: '/chat',
    },
};

export default function ChatPage() {
    return <PublicAiPage />;
}
