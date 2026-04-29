'use client';
import React from 'react';

interface Unit {
    id: string;
    type: string;
    title: string;
    done: boolean;
    active: boolean;
}

interface UnitSidebarProps {
    units: Unit[];
    moduleTitle: string;
    sectionTitle: string;
    onToggle?: () => void;
    onUnitClick?: (unitId: string) => void;
    onPrevSection?: () => void;
    onNextSection?: () => void;
}

export default function UnitSidebar({
    units,
    moduleTitle,
    sectionTitle,
    onToggle,
    onUnitClick,
    onPrevSection,
    onNextSection,
}: UnitSidebarProps) {
    return (
        <aside className="w-[min(300px,calc(100vw-24px))] border-r border-slate-100 flex flex-col bg-white z-[100] flex-shrink-0 h-full shadow-2xl">
            <div className="p-5 border-b border-slate-50 flex flex-col gap-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Module</p>
                <h3 className="text-sm font-black text-slate-800 leading-tight truncate">{moduleTitle}</h3>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                <button
                    onClick={() => onPrevSection && onPrevSection()}
                    title="Previous Section"
                    className="p-1.5 text-[var(--brand)] hover:scale-110 transition-all shrink-0 bg-white shadow-sm border border-slate-200 rounded-md"
                >
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <span className="text-[9px] font-black text-[var(--brand)] uppercase tracking-widest text-center flex-1 truncate">
                    {sectionTitle}
                </span>
                <button
                    onClick={() => onNextSection && onNextSection()}
                    title="Next Section"
                    className="p-1.5 text-[var(--brand)] hover:scale-110 transition-all shrink-0 bg-white shadow-sm border border-slate-200 rounded-md"
                >
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar py-1">
                {units.map((unit) => (
                    <button
                        key={unit.id}
                        onClick={() => (onUnitClick ? onUnitClick(String(unit.id)) : undefined)}
                        className={`w-full px-5 py-3.5 flex items-center gap-4 text-left transition-all border-b border-transparent hover:bg-slate-50 group ${unit.active ? 'bg-[var(--brand-lighter)] border-l-4 border-l-[var(--brand)]' : ''}`}
                    >
                        <div className="flex flex-col items-center w-6 min-w-[24px]">
                            <span
                                className={`text-[8px] font-black uppercase mb-0.5 ${unit.active ? 'text-[var(--brand)]' : 'text-slate-400'}`}
                            >
                                {unit.type}
                            </span>
                        </div>
                        <div className="flex-1">
                            <h4
                                className={`text-xs font-bold leading-tight ${unit.active ? 'text-slate-900' : 'text-slate-600'}`}
                            >
                                {unit.title}
                            </h4>
                            {/* optional small subtitle could be added here if needed */}
                        </div>
                        {unit.done && (
                            <div className="text-green-500">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-[var(--brand)] mb-2">
                    <span>Completion</span>
                    <span>100%</span>
                </div>
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--brand)] w-full transition-all"></div>
                </div>
            </div>
        </aside>
    );
}
