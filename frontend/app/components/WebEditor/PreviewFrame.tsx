'use client';
import React, { useEffect, useRef } from 'react';

interface PreviewFrameProps {
    src: string;
    onMessage?: (data: any) => void;
}

export default function PreviewFrame({ src, onMessage }: PreviewFrameProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (onMessage) onMessage(event.data);
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onMessage]);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Browser-like Header */}
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-3 select-none">
                <div className="flex-1 bg-white border border-slate-200 rounded-full h-7 px-4 flex items-center text-[11px] text-slate-500 font-medium truncate shadow-sm">
                    https://localhost:3002
                </div>
            </div>

            {/* Iframe Content */}
            <div className="flex-1 bg-white relative">
                {!src ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs italic">
                        Press Preview to see changes
                    </div>
                ) : (
                    <iframe
                        ref={iframeRef}
                        src={src}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-same-origin"
                        title="Web Preview"
                    />
                )}
            </div>
        </div>
    );
}
