export const siteConfig = {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Mentrily',
    domain: process.env.NEXT_PUBLIC_APP_DOMAIN || 'mentrily.com',
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Create courses, exams, and certificates with Mentrily',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://mentrily.com',
    company: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Mentrily',
    contactFormName: process.env.NEXT_PUBLIC_CONTACT_FORM_NAME || 'Mentrily Contact Form',
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'admin@mentrily.com',
    adminUserOrgFallback: process.env.NEXT_PUBLIC_ADMIN_USER_ORG_FALLBACK || 'Mentrily (Global)',
    adminSettingsOrgName: process.env.NEXT_PUBLIC_ADMIN_SETTINGS_ORG_NAME || 'Mentrily',
    logo: process.env.NEXT_PUBLIC_APP_LOGO || '/logo.png',
    links: {
        github: process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/mentrily',
    },
};

export type SiteConfig = typeof siteConfig;
