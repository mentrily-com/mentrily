'use client';

import { Clock3, Rocket, Sparkles, X } from 'lucide-react';

type ComingSoonProps = {
    title: string;
    description: string;
    eta?: string;
    variant?: 'page' | 'inline' | 'modal';
    onClose?: () => void;
};

const variantClasses = {
    page: 'min-h-[68vh] rounded-[36px] p-8 md:p-12',
    inline: 'rounded-[28px] p-5 md:p-6',
    modal: 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm',
};

function ComingSoonCard({ title, description, eta, variant = 'page', onClose }: ComingSoonProps) {
    return (
        <div
            className={`relative overflow-hidden border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] ${
                variant === 'modal' ? 'w-full max-w-2xl rounded-[32px] p-7 md:p-9' : variantClasses[variant]
            }`}
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(26,86,219,0.14),transparent_33%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,1))]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(130deg,transparent,rgba(26,86,219,0.05),transparent)] lg:block" />

            <div className="relative">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-light)] bg-[var(--brand-light)]/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--brand)]">
                            <Sparkles size={13} />
                            Coming Soon
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/50">
                                <Rocket size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
                                    {title}
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                                    {description}
                                </p>
                            </div>
                        </div>
                    </div>
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    ) : null}
                </div>

                <div className="mt-8 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            What to expect
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                            A polished workflow built into the current dashboard experience.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                            Planned and reserved in the product flow, but not open for use yet.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">ETA</p>
                        <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Clock3 size={14} className="text-[var(--brand)]" />
                            {eta || 'In an upcoming release'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ComingSoon(props: ComingSoonProps) {
    const { variant = 'page' } = props;

    if (variant === 'modal') {
        return (
            <div className={variantClasses.modal}>
                <ComingSoonCard {...props} />
            </div>
        );
    }

    return <ComingSoonCard {...props} />;
}
