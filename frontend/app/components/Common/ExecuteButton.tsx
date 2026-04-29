'use client';
import React from 'react';

interface ExecuteButtonProps {
    onClick: () => void;
    label?: string;
    icon?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

export default function ExecuteButton({
    onClick,
    label = 'Execute',
    icon,
    className = '',
    disabled,
}: ExecuteButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 px-6 py-1.5 bg-[var(--brand)] text-white text-[11px] font-black uppercase tracking-widest rounded-md hover:bg-[var(--brand-dark)] transition-all active:scale-95 shadow-sm shadow-[var(--brand-light)] ${className}`}
        >
            {label}
            {icon || (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                </svg>
            )}
        </button>
    );
}
