const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.mentrily.com';
const canonicalAppUrl = configuredAppUrl.replace(/^https:\/\/mentrily\.com\/?$/, 'https://www.mentrily.com');

export const siteConfig = {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Mentrily',
    domain: process.env.NEXT_PUBLIC_APP_DOMAIN || 'mentrily.com',
    slogan: process.env.NEXT_PUBLIC_APP_SLOGAN || 'Teach smartly. Mentor easily.',
    description:
        process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
        'Mentrily helps educators create courses, run exams, mentor learners, and issue certificates from one branded learning platform.',
    url: canonicalAppUrl,
    company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Mentrily',
    contactFormName: process.env.NEXT_PUBLIC_CONTACT_FORM_NAME || 'Mentrily Contact Form',
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'admin@mentrily.com',
    adminUserOrgFallback: process.env.NEXT_PUBLIC_ADMIN_USER_ORG_FALLBACK || 'Mentrily (Global)',
    adminSettingsOrgName: process.env.NEXT_PUBLIC_ADMIN_SETTINGS_ORG_NAME || 'Mentrily',
    logo: process.env.NEXT_PUBLIC_APP_LOGO || '/brand/mentrily-logo.svg',
    favicon: process.env.NEXT_PUBLIC_APP_FAVICON || '/android-chrome-192x192.png',
    links: {
        github: process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/mentrily',
    },
};

export type SiteConfig = typeof siteConfig;
