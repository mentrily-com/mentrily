'use client';
import React, { useState, useRef, useEffect } from 'react';

interface SplitPaneProps {
    leftContent: React.ReactNode;
    rightContent: React.ReactNode;
    initialLeftWidth?: number; // percentage
}

export default function SplitPane({ leftContent, rightContent, initialLeftWidth = 50 }: SplitPaneProps) {
    const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Constraints: 10% to 90%
        if (newLeftWidth > 10 && newLeftWidth < 90) {
            setLeftWidth(newLeftWidth);
        }
    };

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopResizing);
            // Disable text selection and pointer events on others during resize
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    return (
        <div ref={containerRef} className="flex h-full w-full flex-col overflow-hidden relative bg-white md:flex-row">
            {/* Left Pane - NO TRANSITIONS DURING RESIZE */}
            <div
                className={`h-[25%] min-h-0 w-full overflow-hidden md:h-full md:[width:var(--left-width)] ${isResizing ? '' : 'transition-[width] duration-300'}`}
                style={{ '--left-width': `${leftWidth}%` } as React.CSSProperties}
            >
                {leftContent}
            </div>

            {/* Resizer Handle */}
            <div
                className={`group absolute top-0 bottom-0 w-[16px] -translate-x-1/2 z-[100] cursor-col-resize hidden items-center justify-center md:flex`}
                style={{ left: `${leftWidth}%` }}
                onMouseDown={startResizing}
            >
                {/* The visual line */}
                <div
                    className={`w-[2px] h-full transition-colors duration-200 ${isResizing ? 'bg-[var(--brand)]' : 'bg-slate-100 group-hover:bg-slate-300'}`}
                ></div>
            </div>

            {/* Right Pane */}
            <div
                className={`h-[75%] min-h-0 w-full overflow-hidden md:h-full md:[width:var(--right-width)] ${isResizing ? '' : 'transition-[width] duration-300'}`}
                style={{ '--right-width': `${100 - leftWidth}%` } as React.CSSProperties}
            >
                {rightContent}
            </div>

            {/* Resize Overlay to prevent iframe/editor interference during drag */}
            {isResizing && <div className="absolute inset-0 z-[90] cursor-col-resize"></div>}
        </div>
    );
}
