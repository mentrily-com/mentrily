'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { StudentService } from '@/services/api/StudentService';
import CoursePlayerSkeleton from '@/app/components/Skeletons/CoursePlayerSkeleton';
import UnitRenderer from '@/app/components/UnitRenderer';
import ExamSidebar from '@/app/components/ExamSidebar';

export default function ExamResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = React.use(params);
    const [loading, setLoading] = useState(true);
    const [resultData, setResultData] = useState<any>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isSidebarHidden, setIsSidebarHidden] = useState(true);

    useEffect(() => {
        async function loadResult() {
            try {
                const data = await StudentService.getExamResult(sessionId);
                setResultData(data);
            } catch (error) {
                console.error('Failed to load result', error);
            } finally {
                setLoading(false);
            }
        }
        loadResult();
    }, [sessionId]);

    useEffect(() => {
        const syncSidebarForViewport = () => setIsSidebarHidden(window.innerWidth < 768);
        syncSidebarForViewport();
        window.addEventListener('resize', syncSidebarForViewport);
        return () => window.removeEventListener('resize', syncSidebarForViewport);
    }, []);

    const currentQuestion = resultData?.questions?.[currentQuestionIndex];

    // Construct sections for Sidebar
    const examSections = useMemo(() => {
        if (!resultData) return [];

        if (resultData.sections && resultData.sections.length > 0) {
            return resultData.sections.map((sec: any) => ({
                ...sec,
                status: 'active', // Ensure sections are unlocked for result viewing
                questions: sec.questions.map((q: any) => ({
                    ...q,
                    status: 'answered',
                })),
            }));
        }

        // Fallback if sections are missing but questions exist
        return [
            {
                id: 'section-1',
                title: 'Exam Questions',
                questions: (resultData.questions || []).map((q: any, idx: number) => ({
                    id: q.id,
                    status: 'answered',
                    number: idx + 1,
                })),
            },
        ];
    }, [resultData]);

    const handleQuestionSelect = (_sectionId: string, questionId: string | number) => {
        const index = resultData.questions.findIndex((q: any) => q.id === questionId);
        if (index !== -1) setCurrentQuestionIndex(index);
        if (window.innerWidth < 768) setIsSidebarHidden(true);
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1);
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < (resultData?.questions?.length || 0) - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-white overflow-hidden">
                <div className="flex-1 overflow-hidden">
                    <CoursePlayerSkeleton hasSidebar={true} isExamMode={false} />
                </div>
            </div>
        );
    }
    if (!resultData)
        return <div className="p-10 text-center text-slate-500">Result not found or not published yet.</div>;

    const userAnswer = resultData.answers?.[currentQuestion?.id];
    const questionTotalMarks =
        Number(currentQuestion?.marks) ||
        Number(currentQuestion?.points) ||
        (currentQuestion?.type === 'Coding' ? 10 : 1);
    const passingPercentage = Number(resultData?.details?.passingPercentage ?? 70);
    const passed = Boolean(resultData?.details?.passed);

    let marksObtained = 0;
    if (resultData.answers?._internal_marks?.[currentQuestion?.id] !== undefined) {
        marksObtained = Number(resultData.answers._internal_marks[currentQuestion.id]);
    } else {
        // Fallback calculation for display
        if (currentQuestion?.type === 'MCQ' || currentQuestion?.type === 'MultiSelect') {
            const correctOptions =
                currentQuestion.mcqOptions?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
            const userSelected = Array.isArray(userAnswer) ? userAnswer : userAnswer ? [userAnswer] : [];

            const isCorrect =
                correctOptions.length > 0 &&
                correctOptions.length === userSelected.length &&
                correctOptions.every((id: string) => userSelected.includes(id));
            if (isCorrect) marksObtained = questionTotalMarks;
        } else if (currentQuestion?.type === 'Coding') {
            if (userAnswer?.score !== undefined) {
                marksObtained = Math.round((userAnswer.score / 100) * questionTotalMarks);
            }
        }
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header with Score Info */}
            <div className="bg-white border-b border-slate-100 px-4 py-3 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <button
                        onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500 transition-colors hover:text-[var(--brand)] md:hidden"
                        aria-label={isSidebarHidden ? 'Show questions' : 'Hide questions'}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-black text-slate-800 sm:text-lg">
                            {resultData.details.examTitle}
                        </h1>
                        <p className="text-xs text-slate-500 font-bold">
                            Submitted: {new Date(resultData.details.submittedAt).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-stretch gap-3 sm:items-center sm:gap-4">
                    <div
                        className={`min-w-[132px] flex-1 rounded-xl px-4 py-2 text-left sm:flex-none sm:text-right ${
                            passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest">Verdict</div>
                        <div className="text-sm font-black">
                            {passed ? 'Passed' : 'Failed'} at {passingPercentage}%
                        </div>
                    </div>
                    <div className="min-w-[132px] flex-1 text-left sm:flex-none sm:text-right">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Score</div>
                        <div className="text-xl font-black text-[var(--brand)]">
                            {resultData.details.score}{' '}
                            <span className="text-slate-300 text-sm">/ {resultData.details.totalMarks}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {!isSidebarHidden && (
                    <div
                        className="absolute inset-0 z-40 bg-slate-900/10 md:hidden"
                        onClick={() => setIsSidebarHidden(true)}
                    />
                )}
                <div className="absolute inset-y-0 left-0 z-50 h-full flex md:relative md:z-auto">
                    <ExamSidebar
                        sections={examSections}
                        currentSectionId={
                            examSections.find((s: any) => s.questions.some((q: any) => q.id === currentQuestion?.id))
                                ?.id || examSections[0]?.id
                        }
                        currentQuestionId={currentQuestion?.id}
                        onQuestionSelect={handleQuestionSelect}
                        collapsed={isSidebarCollapsed}
                        hidden={isSidebarHidden}
                        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        onToggleHidden={() => setIsSidebarHidden(!isSidebarHidden)}
                        onToggleNavbar={() => {}}
                        navbarVisible={true}
                    />
                </div>

                <main className="flex-1 overflow-hidden bg-white relative flex flex-col">
                    <div className="flex-1 overflow-hidden h-full w-full">
                        {currentQuestion && (
                            <UnitRenderer
                                question={currentQuestion}
                                activeTab="question"
                                hideNav={false}
                                hideTabs={true}
                                isExamMode={false}
                                onPrevious={handlePrevious}
                                onNext={handleNext}
                                // Read-only mode simulation
                                selectedAttemptId="submission"
                                viewingAttemptAnswer={userAnswer}
                                currentAnswer={userAnswer}
                                onAnswerChange={() => {}}
                                hideAttemptBanner={true}
                                marksObtained={marksObtained}
                                questionTotalMarks={questionTotalMarks}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
