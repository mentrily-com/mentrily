'use client';

import React from 'react';
import { X } from 'lucide-react';

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
        <div className="fixed inset-0 z-[2200] flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-[24px] border border-slate-100 shadow-2xl p-5 sm:rounded-[28px] sm:p-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                >
                    <X size={18} />
                </button>

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
            </div>
        </div>
    );
}
