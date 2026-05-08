'use client';
import React from 'react';

interface UnitNavHeaderProps {
    activeTab: 'question' | 'attempts';
    onTabChange: (tab: 'question' | 'attempts') => void;
    onToggleSidebar: () => void;
    showSidebar: boolean;
    minimal?: boolean;
    onPrevious?: () => void;
    onNext?: () => void;
    extraContent?: React.ReactNode;
    showSidebarToggle?: boolean;
    hideNavigationButtons?: boolean;
}

export default function UnitNavHeader({
    activeTab,
    onTabChange,
    onToggleSidebar,
    showSidebar,
    minimal = false,
    onPrevious,
    onNext,
    extraContent,
    showSidebarToggle = true,
    hideNavigationButtons = false,
}: UnitNavHeaderProps) {
    return (
        <div className="flex min-h-12 items-center justify-between gap-2 px-2 sm:px-4 border-b border-slate-100 bg-white z-[60] shrink-0 relative isolate">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                {/* Sidebar Toggle */}
                {showSidebarToggle && (
                    <>
                        <button
                            onClick={onToggleSidebar}
                            data-element-id="starter-unit-sidebar-toggle"
                            className={`p-2 transition-all rounded-xl hover:bg-slate-50 ${showSidebar ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
                            title="Toggle Sidebar"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <div className="hidden h-6 w-px bg-slate-100 mx-1 sm:block"></div>
                    </>
                )}

                {/* Integrated Navigation & Tabs Div */}
                <div className="flex min-w-0 items-center overflow-x-auto bg-slate-50/80 border border-slate-100 rounded-xl p-1 gap-1 no-scrollbar">
                    {/* Navigation Buttons */}
                    {!hideNavigationButtons && (
                        <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200/60 mr-1">
                            <button
                                onClick={onPrevious}
                                data-element-id="starter-unit-previous"
                                className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-400 transition-all active:scale-95"
                                title="Previous"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <path d="m15 18-6-6 6-6" />
                                </svg>
                            </button>
                            <button
                                onClick={onNext}
                                data-element-id="starter-unit-next"
                                className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-400 transition-all active:scale-95"
                                title="Next"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Tabs */}
                    {!minimal && (
                        <div className="flex items-center gap-1">
                            {['question', 'attempts'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => onTabChange(tab as any)}
                                    data-element-id={`starter-unit-tab-${tab}`}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all sm:px-4 ${
                                        activeTab === tab
                                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">{extraContent}</div>
        </div>
    );
}

function TabItem({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`h-full px-4 text-[11px] font-black tracking-widest uppercase transition-all border-b-2 flex items-center ${active ? 'text-[var(--brand)] border-[var(--brand)]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
        >
            {label}
        </button>
    );
}
