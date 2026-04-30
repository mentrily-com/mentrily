import Image from 'next/image';
import { siteConfig } from '@/app/config/site';
import { BRAND } from '@/app/constants/brand';
import { cn } from '@/lib/utils';
import { BrandLogo } from './BrandLogo';

type BrandLockupProps = {
    orgName?: string | null;
    orgLogo?: string | null;
    collapsed?: boolean;
    className?: string;
    defaultLogoClassName?: string;
    iconClassName?: string;
    textClassName?: string;
    priority?: boolean;
};

export function isDefaultBrand(orgName?: string | null, orgLogo?: string | null) {
    return (
        (!orgName || orgName === siteConfig.name) &&
        (!orgLogo ||
            orgLogo === siteConfig.logo ||
            orgLogo === '/brand/mentrily-logo.svg' ||
            orgLogo === '/logo.svg')
    );
}

export function BrandLockup({
    orgName,
    orgLogo,
    collapsed = false,
    className,
    defaultLogoClassName,
    iconClassName,
    textClassName,
    priority = false,
}: BrandLockupProps) {
    if (isDefaultBrand(orgName, orgLogo)) {
        if (collapsed) {
            return (
                <Image
                    src={siteConfig.favicon}
                    alt={`${siteConfig.name} icon`}
                    width={192}
                    height={192}
                    className={cn('block h-8 w-8 rounded-lg object-contain', defaultLogoClassName)}
                    priority={priority}
                    unoptimized
                    draggable={false}
                />
            );
        }

        return (
            <BrandLogo
                priority={priority}
                className={cn(collapsed ? 'h-7 max-w-10' : 'h-8 max-w-[160px]', defaultLogoClassName)}
            />
        );
    }

    const displayName = orgName || siteConfig.name;

    return (
        <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
            <div
                className={cn(
                    'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl',
                    !orgLogo && 'bg-[var(--brand)]',
                    iconClassName,
                )}
            >
                {orgLogo ? (
                    <Image
                        src={orgLogo}
                        alt={`${displayName} logo`}
                        fill
                        sizes="36px"
                        className="object-contain p-0.5"
                    />
                ) : (
                    <span className="text-xs font-bold tracking-wider text-white">{BRAND.logoText}</span>
                )}
            </div>
            {!collapsed && (
                <span
                    className={cn(
                        'min-w-0 truncate text-sm font-semibold tracking-tight text-slate-900',
                        textClassName,
                    )}
                >
                    {displayName}
                </span>
            )}
        </div>
    );
}
