import Image from 'next/image';
import { siteConfig } from '@/app/config/site';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
    className?: string;
    priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
    return (
        <Image
            src={siteConfig.logo}
            alt={`${siteConfig.name} logo`}
            width={1666}
            height={598}
            className={cn('block h-auto w-auto object-contain', className)}
            priority={priority}
            // Widest on-screen use is the ~290px auth-page lockup; `sizes`
            // keeps the browser from pulling a needlessly large srcset entry.
            sizes="(max-width: 640px) 250px, 290px"
            draggable={false}
        />
    );
}
