import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Hero from '@/components/sections/Hero';
import SocialProof from '@/components/sections/SocialProof';
import Features from '@/components/sections/Features';
import { siteConfig } from '@/app/config/site';

const RoleSelector = dynamic(() => import('@/components/sections/RoleSelector'));
const HowItWorks = dynamic(() => import('@/components/sections/HowItWorks'));
// const Testimonials = dynamic(() => import('@/components/sections/Testimonials'));
const PricingTeaser = dynamic(() => import('@/components/sections/PricingTeaser'));
const CTASection = dynamic(() => import('@/components/sections/CTASection'));

export const metadata: Metadata = {
    alternates: {
        canonical: '/',
    },
};

const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.company,
    url: siteConfig.url,
    logo: `${siteConfig.url}/android-chrome-512x512.png`,
    email: siteConfig.contactEmail,
    sameAs: [siteConfig.links.github],
};

const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    publisher: {
        '@type': 'Organization',
        name: siteConfig.company,
    },
};

export default function HomePage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
            />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }} />
            <Hero />
            <SocialProof />
            <Features />
            <RoleSelector />
            <HowItWorks />
            {/* <Testimonials /> */}
            <PricingTeaser />
            <CTASection />
        </>
    );
}
