'use client';

import React from 'react';
import { Sparkles, Send } from 'lucide-react';
import AppModal from './AppModal';
import { useToast } from './Toast';
import { BillingService } from '@/services/api/BillingService';

interface UpgradeRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: string | null;
    billingInterval: 'monthly' | 'annual';
    currentPlan: string;
}

export default function UpgradeRequestModal({
    isOpen,
    onClose,
    plan,
    billingInterval,
    currentPlan,
}: UpgradeRequestModalProps) {
    const { success, error } = useToast();
    const [message, setMessage] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isSent, setIsSent] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        setMessage('');
        setIsSent(false);
    }, [isOpen, plan]);

    if (!plan) return null;

    const planLabel = plan.charAt(0) + plan.slice(1).toLowerCase();

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await BillingService.requestPlanUpgrade({
                requestedPlan: plan,
                billingInterval,
                message,
            });
            setIsSent(true);
            success("Request sent — we'll follow up by email shortly.", 'Upgrade Requested');
        } catch (err: any) {
            error(err?.message || 'Failed to send upgrade request', 'Error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppModal
            isOpen={isOpen}
            onClose={handleClose}
            size="sm"
            zIndexClass="z-[2200]"
            eyebrow="Beta"
            title={`Request ${planLabel} access`}
            subtitle={`Currently on ${currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()}`}
            icon={<Sparkles size={20} />}
            ariaLabel={`Request ${planLabel} access`}
            footer={
                isSent ? (
                    <button
                        onClick={handleClose}
                        className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                    >
                        Close
                    </button>
                ) : (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                        <button
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl bg-[var(--brand)] text-white text-xs font-black uppercase tracking-widest hover:bg-[var(--brand-dark)] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                'Sending...'
                            ) : (
                                <>
                                    <Send size={14} />
                                    Send Request
                                </>
                            )}
                        </button>
                    </div>
                )
            }
        >
            {isSent ? (
                <p className="text-sm font-bold text-slate-500">
                    Thanks! Your request for the <span className="text-slate-900">{planLabel}</span> plan has been sent
                    to our team. We&apos;ll reach out at your account email to get you set up.
                </p>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-500">
                        Mentrily is currently in beta, so plan upgrades are handled by our team instead of an automated
                        checkout. Tell us a bit about what you need and we&apos;ll follow up shortly.
                    </p>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                            Message (optional)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={`What are you hoping to do with ${planLabel}?`}
                            rows={4}
                            maxLength={2000}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-900 outline-none focus:border-[var(--brand)] transition-all resize-none placeholder:text-slate-400"
                        />
                    </div>
                </div>
            )}
        </AppModal>
    );
}
