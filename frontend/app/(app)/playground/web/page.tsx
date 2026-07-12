'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import PlaygroundSkeleton from '@/app/components/Skeletons/PlaygroundSkeleton';
import { Globe } from 'lucide-react';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';

const WebEditor = dynamic(() => import('@/app/components/WebEditor/WebEditor'), {
    ssr: false,
    loading: () => <PlaygroundSkeleton />,
});

export default function WebPlaygroundPage({ embeddedShell = true }: { embeddedShell?: boolean }) {
    const content = (
        <div
            className={`w-full flex flex-col overflow-hidden font-sans rounded-lg border bg-white ${
                embeddedShell ? 'h-full min-h-0' : 'h-[70vh] max-h-[720px] min-h-[420px]'
            }`}
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
                        <Globe size={16} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Web Lab
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                            HTML, CSS, and JS in one workspace
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
                <WebEditor
                    showFiles={{
                        html: true,
                        css: true,
                        js: true,
                    }}
                    hideTestCases
                    submitLabel="Preview Submit"
                />
            </div>
        </div>
    );

    if (!embeddedShell) return content;

    return <PublicPlaygroundShell embedded>{content}</PublicPlaygroundShell>;
}
