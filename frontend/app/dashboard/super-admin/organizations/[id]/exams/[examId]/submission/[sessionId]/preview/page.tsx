'use client';
import React, { useState, useMemo, useEffect } from 'react';
import CoursePlayerSkeleton from '@/app/components/Skeletons/CoursePlayerSkeleton';
import UnitRenderer from '@/app/components/UnitRenderer';
import ExamSidebar from '@/app/components/ExamSidebar';

// submission details and questions are now fetched from API

import { TeacherService } from '@/services/api/TeacherService';

export default function SuperAdminSubmissionPreviewPage({
    params,
}: {
    params: Promise<{ id: string; examId: string; sessionId: string }>;
}) {
    const { id, examId, sessionId } = React.use(params);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [activeTab, setActiveTab] = useState<'question' | 'attempts'>('question');
    const [selectedAttemptId, setSelectedAttemptId] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [submissionData, setSubmissionData] = useState<any>(null);

    // Sidebar State - Start Collapsed
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);

    // Grading State
    const [marks, setMarks] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const syncSidebarForViewport = () => {
            const isMobile = window.matchMedia('(max-width: 767px)').matches;
            setIsSidebarHidden(isMobile);
            setIsSidebarCollapsed(true);
        };

        syncSidebarForViewport();
        window.addEventListener('resize', syncSidebarForViewport);

        async function loadSubmission() {
            try {
                // For Super Admin, we can use the same API.
                // The backend checkAccess allows SUPER_ADMIN.
                // We pass examId and sessionId (as identifier).
                const data = await TeacherService.getSubmission(examId, sessionId);
                setSubmissionData(data);

                // Initialize marks if any exist in the data
                if (data.answers && data.answers._internal_marks) {
                    setMarks(data.answers._internal_marks);
                }
            } catch (error) {
                console.error('Failed to load submission', error);
            } finally {
                setLoading(false);
            }
        }
        loadSubmission();
        return () => window.removeEventListener('resize', syncSidebarForViewport);
    }, [examId, sessionId]);

    const currentQuestion = submissionData?.questions?.[currentQuestionIndex];

    // Find viewing answer
    const viewingAttempt = useMemo(() => {
        if (!selectedAttemptId || !currentQuestion || !submissionData) return null;
        return (submissionData.attempts?.[currentQuestion.id] || []).find((a: any) => a.id === selectedAttemptId);
    }, [selectedAttemptId, currentQuestion, submissionData]);

    // Construct sections for ExamSidebar
    const examSections = useMemo(() => {
        if (!submissionData) return [];
        return [
            {
                id: 'section-1',
                title: 'Submission Review',
                questions: (submissionData.questions || []).map((q: any, idx: number) => ({
                    id: q.id,
                    status: 'answered' as const,
                    number: idx + 1,
                })),
            },
        ];
    }, [submissionData]);

    const handleSave = async () => {
        if (!submissionData) return;
        // If teacher is editing per-question marks, we should sum them up
        // or just let them edit the total score directly.
        // For now, let's assume they want to save what they've entered.
        const totalCalculated = Object.values(marks).reduce((acc, curr) => acc + (parseFloat(curr as string) || 0), 0);

        try {
            // Convert marks to numbers for storage
            const internalMarks: Record<string, number> = {};
            Object.entries(marks).forEach(([k, v]) => {
                internalMarks[k] = parseFloat(v as string) || 0;
            });

            await TeacherService.updateSubmissionScore(
                examId,
                submissionData.details.sessionId,
                totalCalculated,
                internalMarks,
            );
            // Update local state to reflect the new score
            setSubmissionData((prev: any) => ({
                ...prev,
                details: { ...prev.details, score: totalCalculated },
            }));
            alert(`Grades saved! Total Score: ${totalCalculated}`);
        } catch (error) {
            console.error('Failed to save grades', error);
            alert('Failed to save grades');
        }
    };

    // Handlers
    const handleQuestionSelect = (sectionId: string, questionId: string | number) => {
        const index = submissionData.questions.findIndex((q: any) => q.id === questionId);
        if (index !== -1) {
            setCurrentQuestionIndex(index);
            setSelectedAttemptId(undefined);
            setActiveTab('question');
        }
    };

    const handleAttemptSelect = (attempt: any) => {
        setSelectedAttemptId(attempt.id);
        setActiveTab('question');
    };

    const handleNext = () => {
        if (!submissionData) return;
        setCurrentQuestionIndex((prev) => (prev + 1) % submissionData.questions.length);
        setSelectedAttemptId(undefined);
    };

    const handlePrevious = () => {
        if (!submissionData) return;
        setCurrentQuestionIndex(
            (prev) => (prev - 1 + submissionData.questions.length) % submissionData.questions.length,
        );
        setSelectedAttemptId(undefined);
    };

    const handleMarkChange = (val: string) => {
        if (!currentQuestion) return;

        // Validate input: allow empty string or numbers only
        if (val !== '' && isNaN(Number(val))) return;

        // Check max marks
        const max =
            Number(currentQuestion.marks) ||
            Number(currentQuestion.points) ||
            (currentQuestion.type === 'Coding' ? 10 : 1);
        if (Number(val) > max) return;

        setMarks((prev) => ({ ...prev, [currentQuestion.id]: val }));
    };

    if (loading) return <CoursePlayerSkeleton hasSidebar={true} isExamMode={false} />;

    if (!submissionData) {
        return (
            <div className="h-[calc(100dvh-var(--topbar-height)-20px)] min-h-0 overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-sm sm:h-[calc(100dvh-var(--topbar-height)-36px)]">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px]">
                            Submission not found
                        </p>
                        <button
                            onClick={() => window.history.back()}
                            className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentQuestionPoints =
        Number(currentQuestion?.marks) ||
        Number(currentQuestion?.points) ||
        (currentQuestion?.type === 'Coding' ? 10 : 1);

    return (
        <div className="h-[calc(100dvh-var(--topbar-height)-20px)] min-h-0 overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-sm sm:h-[calc(100dvh-var(--topbar-height)-36px)]">

            {/* Main Workspace */}
            <main className="flex h-full min-h-0 overflow-hidden">
                {/* Reusable Exam Sidebar */}
                <ExamSidebar
                    sections={examSections}
                    currentSectionId="section-1"
                    currentQuestionId={currentQuestion.id}
                    onQuestionSelect={handleQuestionSelect}
                    collapsed={isSidebarCollapsed}
                    hidden={isSidebarHidden}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    onToggleHidden={() => setIsSidebarHidden(!isSidebarHidden)}
                    showCollapseToggle={true}
                />

                <section className="relative flex min-w-0 flex-1 flex-col bg-white">
                    <UnitRenderer
                        key={`${currentQuestion.id}-${selectedAttemptId || 'current'}`}
                        question={currentQuestion}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        hideNav={true}
                        attempts={submissionData.attempts[currentQuestion.id] || []}
                        showSidebar={!isSidebarHidden}
                        onToggleSidebar={() => setIsSidebarHidden(!isSidebarHidden)}
                        showSidebarToggle={false} // Removed hamburger icon
                        selectedAttemptId={selectedAttemptId}
                        onAttemptSelect={handleAttemptSelect}
                        viewingAttemptAnswer={viewingAttempt?.answer}
                        currentAnswer={submissionData.answers[currentQuestion.id]}
                        onClearAttemptSelection={() => setSelectedAttemptId(undefined)}
                        topHeader={
                            <ConsolidatedHeader
                                studentName={submissionData.details.studentName}
                                rollNo={submissionData.details.rollNo}
                                marks={marks[currentQuestion.id] || ''}
                                maxMarks={currentQuestionPoints}
                                totalScore={submissionData.details.score}
                                onMarkChange={handleMarkChange}
                                onSave={handleSave}
                                onExit={() => window.history.back()}
                            />
                        }
                    />
                </section>
            </main>
        </div>
    );
}

/**
 * Consolidated Header - Professional Grading Strip
 */
function ConsolidatedHeader({ studentName, rollNo, marks, maxMarks, totalScore, onMarkChange, onSave, onExit }: any) {
    return (
        <div className="relative z-50 flex min-h-16 flex-col gap-3 border-b border-slate-100 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
            {/* Left: Student Identity */}
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brand-light)] bg-[var(--brand-light)] text-sm font-black uppercase text-[var(--brand)] shadow-sm">
                        {String(studentName || '?')[0]}
                    </div>
                    <div className="min-w-0">
                        <h4 className="truncate text-sm font-black leading-tight text-slate-800">
                            {studentName}{' '}
                            <span className="font-bold text-slate-300">
                                ({rollNo})
                            </span>
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            Total Score: <span className="text-[var(--brand)]">{totalScore || 0}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Grading Actions */}
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-5">
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2 sm:justify-start sm:border-0 sm:border-r sm:border-slate-100 sm:bg-transparent sm:px-0 sm:py-0 sm:pr-5 lg:pr-8">
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:gap-0">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 opacity-70">
                            Question Score
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                            <input
                                type="text"
                                value={marks}
                                onChange={(e) => onMarkChange(e.target.value)}
                                className="w-14 rounded-xl border border-slate-200 bg-white py-2 text-center text-base font-black text-slate-800 shadow-inner outline-none transition-all focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-light)] sm:bg-slate-50"
                                placeholder="0"
                            />
                            <span className="text-sm font-bold text-slate-400">/ {maxMarks}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
                    <button
                        onClick={onExit}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 active:scale-95 sm:px-6"
                    >
                        Exit
                    </button>
                    <button
                        onClick={onSave}
                        className="group flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition-all hover:-translate-y-0.5 hover:bg-black active:translate-y-0 active:scale-95 sm:px-8"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="group-hover:scale-110 transition-transform"
                        >
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                        </svg>
                        Save Grades
                    </button>
                </div>
            </div>
        </div>
    );
}
