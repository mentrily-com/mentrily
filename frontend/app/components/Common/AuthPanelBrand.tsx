import { BrandLockup } from '@/components/brand/BrandLockup';

type AuthPanelBrandProps = {
    orgName?: string | null;
    orgLogo?: string | null;
    priority?: boolean;
};

export default function AuthPanelBrand({ orgName, orgLogo, priority = false }: AuthPanelBrandProps) {
    return (
        <div className="inline-flex max-w-[230px] rounded-2xl border border-white/20 bg-white/95 px-3.5 py-2 shadow-xl shadow-black/15">
            <BrandLockup
                orgName={orgName}
                orgLogo={orgLogo}
                defaultLogoClassName="h-9 max-w-[190px]"
                iconClassName="h-9 w-9 rounded-lg"
                textClassName="max-w-[160px] text-sm font-bold text-slate-900"
                priority={priority}
            />
        </div>
    );
}
