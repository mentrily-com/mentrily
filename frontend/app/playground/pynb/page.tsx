'use client';
import React from 'react';
import NotebookPlayground from '@/app/components/Playground/NotebookPlayground';
import { TerminalSquare } from 'lucide-react';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';

export default function PythonNotebookPage({ embeddedShell = true }: { embeddedShell?: boolean }) {
    const content = (
        <div
            className="w-full h-full min-h-0 flex flex-col overflow-hidden font-sans rounded-lg border bg-white"
            style={{ borderColor: 'var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}
        >
            <div
                className="h-14 shrink-0 border-b px-5 flex items-center"
                style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}
            >
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-blue-tint)', color: 'var(--brand)' }}
                    >
                        <TerminalSquare size={16} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Notebook Lab
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                            Python notebook with plots and outputs
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <NotebookPlayground />
            </div>
        </div>
    );

    if (!embeddedShell) return content;

    return <PublicPlaygroundShell embedded>{content}</PublicPlaygroundShell>;
}
