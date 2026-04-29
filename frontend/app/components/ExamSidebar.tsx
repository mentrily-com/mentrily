'use client';
import React from 'react';

interface QuestionStatus {
    id: string | number;
    status: 'current' | 'answered' | 'unanswered' | 'review';
    number: number;
}

interface ExamSection {
    id: string;
    title: string;
    questions: QuestionStatus[];
    status?: 'active' | 'locked' | 'submitted';
}

interface ExamSidebarProps {
    sections: ExamSection[];
    currentSectionId: string;
    currentQuestionId: string | number;
    onQuestionSelect: (sectionId: string, questionId: string | number) => void;
    collapsed?: boolean;
    hidden?: boolean;
    onToggleCollapse?: () => void;
    onToggleHidden?: () => void;
    onToggleNavbar?: () => void;
    navbarVisible?: boolean;
    showCollapseToggle?: boolean;
}

export default function ExamSidebar({
    sections,
    currentSectionId,
    currentQuestionId,
    onQuestionSelect,
    collapsed = false,
    hidden = false,
    onToggleCollapse,
    onToggleHidden,
    onToggleNavbar,
    navbarVisible = true,
    showCollapseToggle = true,
}: ExamSidebarProps) {
    const getSectionLabel = (index: number) => String.fromCharCode(65 + index); // A, B, C...

    return (
        <>
            <aside
                className={`
                    relative flex flex-col bg-white border-r border-slate-200 h-full
                    transition-all duration-300 ease-in-out z-40 overflow-visible
                    ${hidden ? 'w-0 border-none' : collapsed ? 'w-16' : 'w-[min(16rem,calc(100vw-24px))]'}
                `}
            >
                {/* Content Container - Hidden when width is 0 */}
                <div className={`flex flex-col h-full ${hidden ? 'hidden' : 'flex'}`}>
                    {/* Control Handles Group (Middle Right) */}
                    <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-[100] flex flex-col items-center gap-3">
                        {showCollapseToggle && (
                            <button
                                onClick={onToggleCollapse}
                                className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 rounded-full shadow-lg text-slate-500 hover:text-[var(--brand)] transition-all hover:scale-110 active:scale-95 cursor-pointer"
                                title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
                                >
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                        )}

                        <button
                            onClick={onToggleHidden}
                            className="flex items-center justify-center w-8 h-16 bg-white border border-slate-200 rounded-full shadow-lg text-slate-500 hover:text-[var(--brand)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Hide Sidebar"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                    </div>

                    {/* Content Area - Scrollable */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 no-scrollbar">
                        {sections.map((section, idx) => {
                            const isLocked = section.status === 'locked';
                            const isSubmitted = section.status === 'submitted';
                            const isActive = section.status === 'active';

                            return (
                                <div
                                    key={section.id}
                                    className={`mb-4 rounded-2xl border bg-slate-50/50 p-2 transition-all relative ${collapsed ? 'px-1' : 'px-2'} ${isLocked || isSubmitted ? 'border-slate-100 opacity-60 grayscale-[0.8] cursor-not-allowed' : 'border-slate-100'}`}
                                >
                                    {/* Lock Overlay for both Locked and Submitted sections */}
                                    {(isLocked || isSubmitted) && (
                                        <div className="absolute inset-0 z-20 bg-slate-50/20 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                                            <div className="w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-slate-400">
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                >
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section Header */}
                                    <div
                                        className={`flex items-center ${collapsed ? 'justify-center mb-2' : 'mb-3 gap-2'}`}
                                    >
                                        <div
                                            className={`
                                            flex items-center justify-center rounded-lg shadow-sm border font-black
                                            ${collapsed ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs'}
                                            ${isSubmitted || isLocked ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-white border-slate-100 text-[var(--brand)]'}
                                        `}
                                        >
                                            {isSubmitted || isLocked ? (
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                >
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                            ) : (
                                                getSectionLabel(idx)
                                            )}
                                        </div>

                                        {!collapsed && (
                                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest truncate flex-1 leading-none flex items-center justify-between">
                                                <span>{section.title}</span>
                                            </h3>
                                        )}
                                    </div>

                                    {/* Section Grid */}
                                    <div
                                        className={`grid gap-1.5 ${collapsed ? 'grid-cols-1 justify-items-center' : 'grid-cols-5'}`}
                                    >
                                        {section.questions.map((q) => {
                                            const isQuestionActive = q.id === currentQuestionId;
                                            const isCurrentSection = section.id === currentSectionId;

                                            // Base colors
                                            let statusColor = 'bg-white border-slate-100 text-slate-400';
                                            if (q.status === 'answered')
                                                statusColor = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                                            if (q.status === 'review')
                                                statusColor = 'bg-amber-50 border-amber-100 text-amber-600';

                                            // Active State (Override) - Only if not locked
                                            if (isQuestionActive && isCurrentSection && !isLocked) {
                                                statusColor =
                                                    'bg-[var(--brand)] border-[var(--brand)] text-white shadow-md shadow-[var(--brand)]/20 scale-110 z-10';
                                            }

                                            return (
                                                <button
                                                    key={q.id}
                                                    onClick={() =>
                                                        !isLocked && !isSubmitted && onQuestionSelect(section.id, q.id)
                                                    }
                                                    disabled={isLocked || isSubmitted}
                                                    className={`
                                                        w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-all
                                                        ${isLocked || isSubmitted ? 'cursor-not-allowed opacity-60' : 'hover:scale-110 active:scale-95 cursor-pointer'}
                                                        ${statusColor}
                                                    `}
                                                    title={
                                                        collapsed
                                                            ? `${section.title} - Q${q.number}`
                                                            : `Question ${q.number}`
                                                    }
                                                >
                                                    {q.number}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer / Legend */}
                    {!collapsed && (
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-tighter text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Solved
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Review
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div> Skipped
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]"></div> Current
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Show Sidebar Toggle Handle (when hidden) */}
            {hidden && (
                <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[100]">
                    <button
                        onClick={onToggleHidden}
                        className="flex items-center justify-center w-8 h-16 bg-white border border-slate-200 rounded-r-full shadow-lg text-slate-500 hover:text-[var(--brand)] transition-all hover:scale-105 hover:pr-2 active:scale-95 cursor-pointer"
                        title="Show Sidebar"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>
            )}
        </>
    );
}
