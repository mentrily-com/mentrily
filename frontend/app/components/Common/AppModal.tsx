'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface AppModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    eyebrow?: React.ReactNode;
    icon?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: AppModalSize;
    zIndexClass?: string;
    panelClassName?: string;
    headerClassName?: string;
    bodyClassName?: string;
    footerClassName?: string;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    ariaLabel?: string;
}

const sizeClasses: Record<AppModalSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
};

export default function AppModal({
    isOpen,
    onClose,
    title,
    subtitle,
    eyebrow,
    icon,
    children,
    footer,
    size = 'md',
    zIndexClass = 'z-[2000]',
    panelClassName,
    headerClassName,
    bodyClassName,
    footerClassName,
    showCloseButton = true,
    closeOnBackdrop = true,
    ariaLabel,
}: AppModalProps) {
    if (!isOpen) return null;

    const hasHeader = title || subtitle || eyebrow || icon || showCloseButton;

    return (
        <div className={cn('fixed inset-0 grid place-items-center p-3 sm:p-6', zIndexClass)}>
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={closeOnBackdrop ? onClose : undefined}
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel || (typeof title === 'string' ? title : 'Dialog')}
                className={cn(
                    'relative z-10 flex max-h-[min(760px,calc(100dvh-48px))] w-full flex-col overflow-hidden rounded-[20px] bg-[#f4f6f9] shadow-[0_28px_90px_rgba(15,23,42,0.36)] animate-in zoom-in-95 duration-200',
                    sizeClasses[size],
                    panelClassName,
                )}
            >
                {hasHeader && (
                    <header className={cn('flex items-start justify-between gap-4 p-5 sm:p-8', headerClassName)}>
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            {icon && (
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white shadow-sm sm:h-12 sm:w-12">
                                    {icon}
                                </div>
                            )}
                            <div className="min-w-0">
                                {eyebrow && (
                                    <p className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest text-slate-400">
                                        {eyebrow}
                                    </p>
                                )}
                                {title && (
                                    <h2 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                                        {title}
                                    </h2>
                                )}
                                {subtitle && (
                                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{subtitle}</p>
                                )}
                            </div>
                        </div>
                        {showCloseButton && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e9edf4] text-slate-500 transition-all hover:bg-white hover:text-slate-900 active:scale-95"
                                aria-label="Close dialog"
                            >
                                <X size={18} strokeWidth={3} />
                            </button>
                        )}
                    </header>
                )}

                <div
                    className={cn(
                        'min-h-0 flex-1 overflow-y-auto px-5 pb-5 no-scrollbar sm:px-8 sm:pb-8',
                        bodyClassName,
                    )}
                >
                    {children}
                </div>

                {footer && (
                    <footer className={cn('border-t border-slate-200/70 bg-slate-50/70 p-4 sm:p-6', footerClassName)}>
                        {footer}
                    </footer>
                )}
            </section>
        </div>
    );
}
