'use client';
import React, { useState, useRef, useEffect } from 'react';

interface SplitPaneProps {
    leftContent: React.ReactNode;
    rightContent: React.ReactNode;
    initialLeftWidth?: number; // percentage
    tabLabels?: [string, string]; // e.g. ['Question', 'Workspace']
}

export default function SplitPane({
    leftContent,
    rightContent,
    initialLeftWidth = 50,
    tabLabels = ['Question', 'Workspace'],
}: SplitPaneProps) {
    const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
    const [isResizing, setIsResizing] = useState(false);
    const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left');
    const containerRef = useRef<HTMLDivElement>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        if (containerRef.current) {
            rectRef.current = containerRef.current.getBoundingClientRect();
        }
        setIsResizing(true);
    };

    const stopResizing = () => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        setIsResizing(false);
        rectRef.current = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        if (rafIdRef.current) return;

        const clientX = e.clientX;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const containerRect = rectRef.current || containerRef.current?.getBoundingClientRect();
            if (!containerRect || containerRect.width === 0) return;

            const containerWidth = containerRect.width;
            const minPx = 220;
            if (containerWidth <= minPx * 2) return;

            const leftPx = clientX - containerRect.left;
            const clampedPx = Math.max(minPx, Math.min(leftPx, containerWidth - minPx));
            const newLeftWidth = (clampedPx / containerWidth) * 100;
            setLeftWidth(newLeftWidth);
        });
    };

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    return (
        <div ref={containerRef} className="flex h-full w-full flex-col overflow-hidden relative bg-white md:flex-row">
            {/* Mobile Tab Switcher (< md) */}
            <div className="flex h-10 w-full shrink-0 border-b border-slate-200 bg-slate-50 md:hidden z-10 select-none">
                <button
                    type="button"
                    onClick={() => setMobileTab('left')}
                    className={`flex-1 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        mobileTab === 'left'
                            ? 'border-b-2 border-[var(--brand)] bg-white text-[var(--brand)] shadow-sm font-black'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    {tabLabels[0]}
                </button>
                <button
                    type="button"
                    onClick={() => setMobileTab('right')}
                    className={`flex-1 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        mobileTab === 'right'
                            ? 'border-b-2 border-[var(--brand)] bg-white text-[var(--brand)] shadow-sm font-black'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    {tabLabels[1]}
                </button>
            </div>

            {/* Left Pane */}
            <div
                className={`min-h-0 w-full md:h-full md:[width:var(--left-width)] ${
                    isResizing ? '' : 'transition-[width] duration-300'
                } ${mobileTab === 'left' ? 'flex-1 overflow-hidden' : 'hidden md:block'}`}
                style={{ '--left-width': `${leftWidth}%` } as React.CSSProperties}
            >
                {leftContent}
            </div>

            {/* Desktop Resizer Handle */}
            <div
                className="group absolute top-0 bottom-0 w-[16px] -translate-x-1/2 z-[100] cursor-col-resize hidden items-center justify-center md:flex"
                style={{ left: `${leftWidth}%` }}
                onMouseDown={startResizing}
            >
                {/* The visual line */}
                <div
                    className={`w-[2px] h-full transition-colors duration-200 ${
                        isResizing ? 'bg-[var(--brand)]' : 'bg-slate-100 group-hover:bg-slate-300'
                    }`}
                ></div>
            </div>

            {/* Right Pane */}
            <div
                className={`min-h-0 w-full md:h-full md:[width:var(--right-width)] ${
                    isResizing ? '' : 'transition-[width] duration-300'
                } ${mobileTab === 'right' ? 'flex-1 overflow-hidden' : 'hidden md:block'}`}
                style={{ '--right-width': `${100 - leftWidth}%` } as React.CSSProperties}
            >
                {rightContent}
            </div>

            {/* Fixed resize overlay across entire window prevents iframe/editor pointer theft during drag */}
            {isResizing && <div className="fixed inset-0 z-[9999] cursor-col-resize select-none pointer-events-auto"></div>}
        </div>
    );
}
