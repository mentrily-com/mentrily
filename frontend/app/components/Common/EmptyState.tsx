'use client';
import Link from 'next/link';
import React from 'react';

interface EmptyStateAction {
    label: string;
    href?: string;
    onClick?: () => void;
}

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    action?: EmptyStateAction;
    className?: string;
}

/**
 * Shared empty-state treatment (icon + heading + subtext + optional CTA),
 * lifted out of the pattern already used for learner bookmarks/certificates
 * -- several important lists (students roster, exams list) previously fell
 * back to a single bare "No X found" line with no icon or next action,
 * which read as unfinished next to lists that already had the fuller
 * treatment. One component keeps that fuller treatment consistent instead
 * of every list re-implementing its own version.
 */
export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
    return (
        <div className={`text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 ${className}`}>
            <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-sm mb-4 text-slate-400">
                {icon}
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">{title}</h3>
            {description && <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm font-medium">{description}</p>}
            {action &&
                (action.href ? (
                    <Link
                        href={action.href}
                        className="inline-flex px-6 py-3 bg-[var(--brand)] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--brand-dark)] transition-all"
                    >
                        {action.label}
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className="inline-flex cursor-pointer px-6 py-3 bg-[var(--brand)] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[var(--brand-dark)] transition-all"
                    >
                        {action.label}
                    </button>
                ))}
        </div>
    );
}
