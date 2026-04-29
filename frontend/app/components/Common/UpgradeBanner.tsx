'use client';

interface UpgradeBannerProps {
    title?: string;
    message: string;
    ctaLabel?: string;
    onUpgrade?: () => void;
}

export default function UpgradeBanner({
    title = 'Upgrade Required',
    message,
    ctaLabel = 'View Plans',
    onUpgrade,
}: UpgradeBannerProps) {
    return (
        <div className="rounded-2xl border border-[var(--brand-light)] bg-[var(--brand-light)]/25 p-4 flex items-center justify-between gap-4">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand)]">{title}</p>
                <p className="text-xs font-bold text-slate-600 mt-1">{message}</p>
            </div>
            <button
                type="button"
                onClick={onUpgrade}
                className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[var(--brand-dark)] transition-all"
            >
                {ctaLabel}
            </button>
        </div>
    );
}
