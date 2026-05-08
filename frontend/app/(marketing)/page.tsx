import dynamic from 'next/dynamic';
import Hero from '@/components/sections/Hero';
import SocialProof from '@/components/sections/SocialProof';
import Features from '@/components/sections/Features';

const RoleSelector = dynamic(() => import('@/components/sections/RoleSelector'));
const HowItWorks = dynamic(() => import('@/components/sections/HowItWorks'));
const Testimonials = dynamic(() => import('@/components/sections/Testimonials'));
const PricingTeaser = dynamic(() => import('@/components/sections/PricingTeaser'));
const CTASection = dynamic(() => import('@/components/sections/CTASection'));

export default function HomePage() {
    return (
        <>
            <Hero />
            <SocialProof />
            <Features />
            <RoleSelector />
            <HowItWorks />
            <Testimonials />
            <PricingTeaser />
            <CTASection />
        </>
    );
}
