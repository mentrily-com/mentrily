'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import PlaygroundSkeleton from '@/app/components/Skeletons/PlaygroundSkeleton';
import { Globe } from 'lucide-react';

const WebEditor = dynamic(() => import('@/app/components/WebEditor/WebEditor'), {
    ssr: false,
    loading: () => <PlaygroundSkeleton />,
});

export default function WebPlaygroundPage() {
    return (
        <div className="w-full h-full min-h-0 flex flex-col overflow-hidden font-sans rounded-2xl border bg-white" style={{ borderColor: 'var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="h-14 shrink-0 border-b px-5 flex items-center" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-blue-tint)', color: 'var(--brand)' }}>
                        <Globe size={16} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Web Lab</p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>HTML, CSS, and JS in one workspace</p>
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
                />
            </div>
        </div>
    );
}
