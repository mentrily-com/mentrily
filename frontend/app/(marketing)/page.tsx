import Hero from '@/components/sections/Hero';
import SocialProof from '@/components/sections/SocialProof';
import RoleSelector from '@/components/sections/RoleSelector';
import Features from '@/components/sections/Features';
import HowItWorks from '@/components/sections/HowItWorks';
import Testimonials from '@/components/sections/Testimonials';
import PricingTeaser from '@/components/sections/PricingTeaser';
import CTASection from '@/components/sections/CTASection';

export default function HomePage() {
    return (
        <>
            <Hero />
            <SocialProof />
            <RoleSelector />
            <Features />
            <HowItWorks />
            <Testimonials />
            <PricingTeaser />
            <CTASection />
        </>
    );
}
