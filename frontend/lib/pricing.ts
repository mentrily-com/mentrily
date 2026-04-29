export type PricingTier = {
    id: string;
    name: string;
    monthlyPrice: number | null;
    yearlyPrice: number | null;
    description: string;
    cta: string;
    ctaHref: string;
    highlighted: boolean;
    badge?: string;
    features: string[];
    limits: {
        courses: string;
        students: string;
        seats: string;
        storage: string;
    };
};

export const pricingTiers: PricingTier[] = [
    {
        id: 'free',
        name: 'Free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        description: 'Get started with the basics. Perfect for trying out the platform.',
        cta: 'Start Free',
        ctaHref: '/signup',
        highlighted: false,
        features: [
            'MCQ + Reading content only',
            'Up to 2 exams per month',
            'Community support only',
            'Mentrily branding',
        ],
        limits: {
            courses: '2 courses',
            students: '50 students',
            seats: '1 seat',
            storage: '500MB',
        },
    },
    {
        id: 'starter',
        name: 'Starter',
        monthlyPrice: 39,
        yearlyPrice: 390,
        description: 'Everything you need to run a real school with coding and exams.',
        cta: 'Start Starter',
        ctaHref: '/signup?plan=starter',
        highlighted: false,
        features: [
            'Coding challenges (33 langs)',
            'Web Editor',
            'Proctored exams',
            '10 exams per month',
            '2 admin seats + 3 teacher seats',
            'Email support (48h SLA)',
        ],
        limits: {
            courses: '15 courses',
            students: '200 students',
            seats: '5 seats',
            storage: '5GB',
        },
    },
    {
        id: 'pro',
        name: 'Pro',
        monthlyPrice: 119,
        yearlyPrice: 1190,
        description: 'Full power for growing schools. AI exams, advanced analytics, and higher team limits.',
        cta: 'Start Pro',
        ctaHref: '/signup?plan=pro',
        highlighted: true,
        badge: 'Most Popular',
        features: [
            'Python Notebook',
            'AI exam generation (Coming Soon)',
            'Tab-switch detection + IP proctoring',
            '20 exams per month',
            '5 admin seats + 10 teacher seats',
            'Advanced analytics',
            'Priority support (24h SLA)',
        ],
        limits: {
            courses: '30 courses',
            students: '1,000 students',
            seats: '15 seats',
            storage: '50GB',
        },
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        monthlyPrice: null,
        yearlyPrice: null,
        description: 'For institutions that need full control and dedicated infrastructure.',
        cta: 'Contact Sales',
        ctaHref: '/contact?category=sales',
        highlighted: false,
        features: [
            'Custom domain and white-label branding',
            'Subdomain control',
            'SSO / SAML',
            'Dedicated code execution instance',
            '99.9% SLA',
            'Dedicated Slack support',
            'On-premise option',
            'Unlimited everything',
        ],
        limits: {
            courses: 'Unlimited',
            students: 'Unlimited',
            seats: 'Unlimited',
            storage: 'Unlimited',
        },
    },
];

export type ComparisonCategory = {
    name: string;
    features: {
        name: string;
        free: string | boolean;
        starter: string | boolean;
        pro: string | boolean;
        enterprise: string | boolean;
    }[];
};

export const comparisonData: ComparisonCategory[] = [
    {
        name: 'Content',
        features: [
            { name: 'Courses', free: '2', starter: '15', pro: '30', enterprise: 'Unlimited' },
            { name: 'MCQ Questions', free: true, starter: true, pro: true, enterprise: true },
            { name: 'Multi-select Questions', free: true, starter: true, pro: true, enterprise: true },
            { name: 'Reading Content', free: true, starter: true, pro: true, enterprise: true },
            { name: 'Coding Challenges (33 langs)', free: false, starter: true, pro: true, enterprise: true },
            { name: 'Web Editor', free: false, starter: true, pro: true, enterprise: true },
            { name: 'Python Notebook', free: false, starter: false, pro: true, enterprise: true },
        ],
    },
    {
        name: 'Exams',
        features: [
            { name: 'Monthly Exams', free: '2', starter: '10', pro: '20', enterprise: 'Unlimited' },
            { name: 'Test Codes', free: false, starter: true, pro: true, enterprise: true },
            { name: 'Auto-submit Timer', free: false, starter: true, pro: true, enterprise: true },
            { name: 'Basic Proctoring', free: false, starter: true, pro: true, enterprise: true },
            { name: 'Tab-switch Detection', free: false, starter: false, pro: true, enterprise: true },
            { name: 'IP Tracking', free: false, starter: false, pro: true, enterprise: true },
            { name: 'AI Exam Generation', free: false, starter: false, pro: false, enterprise: false },
            { name: 'Custom URLs / Slugs', free: false, starter: false, pro: false, enterprise: true },
        ],
    },
    {
        name: 'Branding',
        features: [
            { name: 'Custom Logo', free: false, starter: false, pro: false, enterprise: true },
            { name: 'Remove Mentrily Branding', free: false, starter: false, pro: false, enterprise: true },
            { name: 'Custom Domain (CNAME)', free: false, starter: false, pro: false, enterprise: true },
            { name: 'Full White-label', free: false, starter: false, pro: false, enterprise: true },
        ],
    },
    {
        name: 'Analytics',
        features: [
            { name: 'Basic Reports', free: true, starter: true, pro: true, enterprise: true },
            { name: 'Student Progress Tracking', free: false, starter: true, pro: true, enterprise: true },
            { name: 'Advanced Analytics', free: false, starter: false, pro: true, enterprise: true },
        ],
    },
    {
        name: 'Support',
        features: [
            { name: 'Community Forum', free: true, starter: true, pro: true, enterprise: true },
            { name: 'Email Support', free: false, starter: '48h SLA', pro: '24h SLA', enterprise: '2h SLA' },
            { name: 'Dedicated Slack', free: false, starter: false, pro: false, enterprise: true },
            { name: 'SSO / SAML', free: false, starter: false, pro: false, enterprise: true },
        ],
    },
];

export const faqItems = [
    {
        question: 'What is a seat?',
        answer: 'Seats are split between Admin and Teacher roles on paid plans. Students never count as seats.',
    },
    {
        question: 'Can I change plans anytime?',
        answer: 'Yes. Upgrade instantly, downgrade at end of billing period.',
    },
    {
        question: 'What happens when I hit the student limit?',
        answer: "You'll see a warning at 80%. At the limit, new student creation is blocked until you upgrade or remove students.",
    },
    {
        question: 'Do my students pay anything?',
        answer: 'No. Students access your school for free. You pay one flat fee for the whole school.',
    },
    {
        question: 'Is white-labeling available on Free?',
        answer: 'No. White-labeling and custom domains are Enterprise-only.',
    },
    {
        question: 'What coding languages are supported?',
        answer: '33 languages including Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, Ruby, PHP, and more.',
    },
    {
        question: 'Is there a free trial for paid plans?',
        answer: 'The Free plan is permanent. No time-limited trial needed — you can fully explore the platform before upgrading.',
    },
    {
        question: 'What is the difference between Starter and Pro for exams?',
        answer: 'Starter includes coding, web editor, and 10 monthly exams. Pro adds notebooks, AI exams, stronger proctoring, and higher limits.',
    },
];
