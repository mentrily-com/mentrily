'use client';

interface QuotaBarProps {
    label: string;
    used: number;
    limit: number;
}

export default function QuotaBar({ label, used, limit }: QuotaBarProps) {
    const unlimited = limit < 0;
    const percent = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
                <span className="text-[10px] font-semibold text-gray-500">
                    {unlimited ? `${used} / Unlimited` : `${used} / ${limit}`}
                </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[var(--brand)] rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}
