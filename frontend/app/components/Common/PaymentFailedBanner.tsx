'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BillingService } from '@/services/api/BillingService';
import { useToast } from './Toast';

interface PaymentFailedBannerProps {
    returnUrl?: string;
}

export default function PaymentFailedBanner({ returnUrl }: PaymentFailedBannerProps) {
    const [isBusy, setIsBusy] = useState(false);
    const { error } = useToast();

    const handleFixNow = async () => {
        try {
            setIsBusy(true);
            const result = await BillingService.createPortalSession({
                returnUrl: returnUrl || (typeof window !== 'undefined' ? window.location.href : undefined),
            });

            if (result?.url) {
                window.location.href = result.url;
            }
        } catch (err: any) {
            error(err?.message || 'Unable to open billing portal', 'Billing Error');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="w-full bg-red-600 text-white sticky top-0 z-[1200] shadow-sm">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle size={16} className="shrink-0" />
                    <p className="text-xs sm:text-sm font-black tracking-wide truncate">
                        Your payment failed. Update your payment method to avoid losing access.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleFixNow}
                    disabled={isBusy}
                    className="shrink-0 rounded-lg bg-white text-red-600 px-3 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-60"
                >
                    {isBusy ? 'Opening...' : 'Fix Now →'}
                </button>
            </div>
        </div>
    );
}
