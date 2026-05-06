'use client';

import React from 'react';
import AppModal from './AppModal';

interface UpgradeModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    onClose: () => void;
    onUpgrade?: () => void;
}

export default function UpgradeModal({
    isOpen,
    title = 'Upgrade Plan',
    message,
    onClose,
    onUpgrade,
}: UpgradeModalProps) {
    if (!isOpen) return null;

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            zIndexClass="z-[2200]"
            showCloseButton={false}
            bodyClassName="p-5 sm:p-8"
            ariaLabel={title}
        >
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
            <p className="text-sm font-bold text-slate-500 mt-2">{message}</p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                    Close
                </button>
                <button
                    onClick={onUpgrade}
                    className="flex-1 py-3 rounded-xl bg-[var(--brand)] text-white text-xs font-black uppercase tracking-widest hover:bg-[var(--brand-dark)] transition-all"
                >
                    Upgrade
                </button>
            </div>
        </AppModal>
    );
}
