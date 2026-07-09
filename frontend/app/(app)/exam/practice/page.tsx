'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar, { ExamConfig } from '@/app/components/Navbar';
import ExamSidebar from '@/app/components/ExamSidebar';
import UnitRenderer, { UnitQuestion } from '@/app/components/UnitRenderer';
import ExamSubmitView from '@/app/components/ExamSubmitView';
import { createGuide, type GuideStep } from '@/app/components/Common/hints/guide';

const TOUR_DONE_KEY = 'tour_practice_exam_completed';
const DRAFT_KEY = 'practice_exam_draft_v1';
const PRACTICE_DURATION_SECONDS = 15 * 60;
/** Mirrors a typical real-exam tab switch allowance so the warning copy feels real. */
const TAB_SWITCH_DEMO_LIMIT = 3;

type SectionDef = {
    id: string;
    title: string;
    questionIds: string[];
};

const PRACTICE_SECTIONS: SectionDef[] = [
    { id: 'ps1', title: 'How Exams Work', questionIds: ['pq1', 'pq2', 'pq3'] },
    { id: 'ps2', title: 'Mini Mock Exam', questionIds: ['pq4', 'pq5'] },
];

const PRACTICE_QUESTIONS: Record<string, UnitQuestion> = {
    pq1: {
        id: 'pq1',
        type: 'MCQ',
        title: 'Welcome to the practice exam',
        difficulty: 'Easy',
        topic: 'Orientation',
        description: `
            <p>This is a <strong>practice run</strong> — nothing here is graded or recorded. It exists so the real exam feels familiar on day one.</p>
            <p>The screen is split in two: the question you are reading lives on the <strong>left</strong>, and the answer area is always on the <strong>right</strong>. The panel on the far left is the <strong>question palette</strong> — it shows every section and question at a glance.</p>
            <p>Let's check you found it. Answer on the right, then press <strong>Submit</strong>.</p>`,
        mcqOptions: [
            { id: 'a', text: 'The question palette on the far left', isCorrect: true },
            { id: 'b', text: 'The browser address bar' },
            { id: 'c', text: 'There is no way to see all questions' },
        ],
    },
    pq2: {
        id: 'pq2',
        type: 'MCQ',
        title: 'Not sure about an answer?',
        difficulty: 'Easy',
        topic: 'Orientation',
        description: `
            <p>Sometimes you'll want to come back to a question later. Use the <strong>flag button</strong> at the top-right of this panel to <strong>mark a question for review</strong>.</p>
            <p>Flagged questions turn <strong>amber</strong> in the question palette so they're easy to spot before you submit.</p>
            <p>Try it now: click the flag above, watch this question change colour in the palette, then answer below.</p>`,
        mcqOptions: [
            { id: 'a', text: 'It deletes the question' },
            { id: 'b', text: 'It highlights the question in the palette so I can revisit it', isCorrect: true },
            { id: 'c', text: 'It submits my answer immediately' },
        ],
    },
    pq3: {
        id: 'pq3',
        type: 'MultiSelect',
        title: 'Reading the question palette',
        difficulty: 'Easy',
        topic: 'Orientation',
        description: `
            <p>The palette colour-codes every question. This one allows <strong>multiple answers</strong> — select every statement that is true, then submit.</p>
            <p><em>Tip: this is the last question of the section, so submitting it will take you to the section summary screen. That's intentional — it's the next thing to learn!</em></p>`,
        mcqOptions: [
            { id: 'a', text: 'Answered questions are marked as completed in the palette', isCorrect: true },
            { id: 'b', text: 'Questions marked for review are highlighted', isCorrect: true },
            { id: 'c', text: 'The current question is emphasised', isCorrect: true },
            { id: 'd', text: 'The palette shows other students’ answers' },
        ],
    },
    pq4: {
        id: 'pq4',
        type: 'MCQ',
        title: 'Mock question: logic warm-up',
        difficulty: 'Easy',
        topic: 'Warm-up',
        description: `
            <p>You've unlocked section B — this is what a normal exam question looks like. Notice the section switch in the palette: section A is now <strong>submitted and locked</strong>. In real exams you cannot return to a submitted section, so always double-check the summary screen first.</p>
            <p><strong>Question:</strong> A sequence goes 2, 4, 8, 16… what is the next number?</p>`,
        mcqOptions: [
            { id: 'a', text: '18' },
            { id: 'b', text: '24' },
            { id: 'c', text: '32', isCorrect: true },
            { id: 'd', text: '64' },
        ],
    },
    pq5: {
        id: 'pq5',
        type: 'MCQ',
        title: 'Mock question: finishing an exam',
        difficulty: 'Easy',
        topic: 'Warm-up',
        description: `
            <p>Last one. When you submit this final section you'll see the <strong>confirmation screen</strong>: it asks you to type a 4-digit code before anything is final, so an accidental click can never end your exam.</p>
            <p><strong>Question:</strong> What happens if you accidentally open the submit screen in a real exam?</p>`,
        mcqOptions: [
            { id: 'a', text: 'The exam ends instantly' },
            {
                id: 'b',
                text: 'Nothing — I can go back, and submitting requires typing a confirmation code',
                isCorrect: true,
            },
            { id: 'c', text: 'I lose all my saved answers' },
        ],
    },
};

const TOUR_STEPS: GuideStep[] = [
    {
        title: 'Welcome to your practice exam 👋',
        description:
            'This is a safe sandbox: no grades, no proctoring, no time pressure. In under two minutes this guide will show you every control you will use in a real course exam.',
    },
    {
        element: '[data-tour="practice-sidebar"]',
        title: 'The question palette',
        description:
            'Every section and question lives here. Colours tell you what is answered, unanswered, flagged for review, or currently open — click any number to jump straight to it.',
        side: 'right',
    },
    {
        element: '[data-element-id="starter-question-prompt"]',
        title: 'Read the question here',
        description:
            'The left panel always holds the question statement. Use the font-size controls in the top bar if you want the text bigger or smaller.',
        side: 'right',
    },
    {
        element: '[data-element-id="starter-mark-review"]',
        title: 'Flag anything you want to revisit',
        description:
            'Unsure? Flag the question and keep moving. Flagged questions glow amber in the palette so you can circle back before submitting the section.',
        side: 'bottom',
    },
    {
        element: '[data-element-id="starter-answer-workspace"]',
        title: 'Answer on the right',
        description:
            'Multiple choice, code editors, or web builders — your workspace is always this right-hand panel. Selections save as you go.',
        side: 'left',
    },
    {
        element: '[data-element-id="starter-submit-answer"]',
        title: 'Submit locks in the answer and moves on',
        description:
            'Pressing Submit records your answer and advances to the next question automatically. You can still change it any time before the section is submitted.',
        side: 'top',
    },
    {
        element: '[data-tour="practice-timer"]',
        title: 'Keep an eye on the clock',
        description:
            'The timer counts down the full exam. It turns red and pulses during the final five minutes. When it hits zero, answers are submitted automatically.',
        side: 'bottom',
    },
    {
        element: '[data-tour="practice-focus"]',
        title: 'Tab switches are watched',
        description:
            'Every time you leave the exam tab or window it is counted here — red for exits, green for returns. In a real exam each switch is recorded for your instructor, and passing the limit can end your exam automatically. Try it now: practice mode only warns you.',
        side: 'bottom',
    },
    {
        element: '[data-tour="practice-submit"]',
        title: 'Finish a section here',
        description:
            'When a section is done, open the submission summary. You will review every question, then confirm with a 4-digit code — nothing is submitted by accident.',
        side: 'bottom',
    },
    {
        title: 'You are ready 🎉',
        description:
            'That is the whole interface. Work through these five practice questions at your own pace — you can replay this guide any time with the “Guide” button in the top bar.',
    },
];

type DraftState = {
    answers: Record<string, string[]>;
    review: string[];
    submittedSections: string[];
    focus?: { in: number; out: number };
};

function readDraft(): DraftState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        return raw ? (JSON.parse(raw) as DraftState) : null;
    } catch {
        return null;
    }
}

export default function PracticeExamPage() {
    const router = useRouter();

    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [reviewFlags, setReviewFlags] = useState<Set<string>>(new Set());
    const [submittedSections, setSubmittedSections] = useState<Set<string>>(new Set());
    const [currentSectionId, setCurrentSectionId] = useState('ps1');
    const [currentQuestionId, setCurrentQuestionId] = useState('pq1');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarHidden, setSidebarHidden] = useState(false);
    const [isSubmitViewOpen, setIsSubmitViewOpen] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState(PRACTICE_DURATION_SECONDS);
    const [fontSize, setFontSize] = useState(15);
    const [hydrated, setHydrated] = useState(false);
    const [windowFocus, setWindowFocus] = useState({ in: 0, out: 0 });
    const [focusAlert, setFocusAlert] = useState<{ outCount: number } | null>(null);
    const guideRef = useRef<ReturnType<typeof createGuide> | null>(null);
    const focusAlertTimerRef = useRef<number | null>(null);

    // --- Restore a draft on mount (refresh-safe, session only) ---
    useEffect(() => {
        const draft = readDraft();
        if (draft) {
            setAnswers(draft.answers || {});
            setReviewFlags(new Set(draft.review || []));
            setSubmittedSections(new Set(draft.submittedSections || []));
            if (draft.focus) setWindowFocus(draft.focus);
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        try {
            const draft: DraftState = {
                answers,
                review: Array.from(reviewFlags),
                submittedSections: Array.from(submittedSections),
                focus: windowFocus,
            };
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* storage full or unavailable — practice data is disposable */
        }
    }, [answers, reviewFlags, submittedSections, windowFocus, hydrated]);

    const windowFocusRef = useRef(windowFocus);
    useEffect(() => {
        windowFocusRef.current = windowFocus;
    }, [windowFocus]);

    // --- Focus monitoring, same semantics as a real exam (grace period,
    // dedupe, unload guard) — but here it only counts and coaches. ---
    useEffect(() => {
        if (isFinished) return;

        let isGracePeriod = true;
        const graceTimer = window.setTimeout(() => {
            isGracePeriod = false;
        }, 3000);

        let isFocused = document.hasFocus();
        let isUnloading = false;
        const handleBeforeUnload = () => {
            isUnloading = true;
        };

        const handleFocusLoss = () => {
            if (isGracePeriod || isUnloading || !isFocused) return;
            isFocused = false;
            setWindowFocus((prev) => ({ ...prev, out: prev.out + 1 }));
        };

        const handleFocusGain = () => {
            if (isGracePeriod || isFocused) return;
            isFocused = true;
            setWindowFocus((prev) => ({ ...prev, in: prev.in + 1 }));
            // Warn on return — the user can't read anything while away.
            setFocusAlert({ outCount: windowFocusRef.current.out });
            if (focusAlertTimerRef.current) window.clearTimeout(focusAlertTimerRef.current);
            focusAlertTimerRef.current = window.setTimeout(() => setFocusAlert(null), 8000);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') handleFocusGain();
            else handleFocusLoss();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleFocusLoss);
        window.addEventListener('focus', handleFocusGain);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.clearTimeout(graceTimer);
            if (focusAlertTimerRef.current) window.clearTimeout(focusAlertTimerRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleFocusLoss);
            window.removeEventListener('focus', handleFocusGain);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isFinished]);

    // --- Cosmetic countdown ---
    useEffect(() => {
        if (isFinished) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isFinished]);

    // --- Guided tour ---
    const startGuide = useCallback(() => {
        guideRef.current?.destroy();
        const guide = createGuide(TOUR_STEPS, {
            kicker: 'Practice Exam Guide',
            doneLabel: 'Start practicing',
            onDismissed: (finished) => {
                if (finished) {
                    try {
                        localStorage.setItem(TOUR_DONE_KEY, 'true');
                    } catch {
                        /* ignore */
                    }
                }
            },
        });
        guideRef.current = guide;
        guide.drive();
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        let seen = false;
        try {
            seen = localStorage.getItem(TOUR_DONE_KEY) === 'true';
        } catch {
            /* ignore */
        }
        if (seen) return;
        const timeout = window.setTimeout(startGuide, 700);
        return () => window.clearTimeout(timeout);
    }, [hydrated, startGuide]);

    useEffect(() => () => guideRef.current?.destroy(), []);

    // --- Derived sidebar model ---
    const sidebarSections = useMemo(
        () =>
            PRACTICE_SECTIONS.map((section) => ({
                id: section.id,
                title: section.title,
                status: submittedSections.has(section.id) ? ('submitted' as const) : ('active' as const),
                questions: section.questionIds.map((qid, idx) => ({
                    id: qid,
                    number: idx + 1,
                    status:
                        qid === currentQuestionId
                            ? ('current' as const)
                            : reviewFlags.has(qid)
                              ? ('review' as const)
                              : (answers[qid]?.length ?? 0) > 0
                                ? ('answered' as const)
                                : ('unanswered' as const),
                })),
            })),
        [answers, currentQuestionId, reviewFlags, submittedSections],
    );

    const currentQuestion = PRACTICE_QUESTIONS[currentQuestionId];

    const handleQuestionSelect = useCallback(
        (sectionId: string, questionId: string | number) => {
            if (submittedSections.has(sectionId)) return;
            setCurrentSectionId(sectionId);
            setCurrentQuestionId(String(questionId));
        },
        [submittedSections],
    );

    const goToOffset = useCallback(
        (offset: 1 | -1) => {
            const section = PRACTICE_SECTIONS.find((s) => s.id === currentSectionId);
            if (!section) return;
            const qIdx = section.questionIds.indexOf(currentQuestionId);
            const nextIdx = qIdx + offset;
            if (nextIdx >= 0 && nextIdx < section.questionIds.length) {
                setCurrentQuestionId(section.questionIds[nextIdx]);
                return;
            }
            const sIdx = PRACTICE_SECTIONS.findIndex((s) => s.id === currentSectionId);
            const nextSection = PRACTICE_SECTIONS[sIdx + offset];
            if (!nextSection || submittedSections.has(nextSection.id)) return;
            setCurrentSectionId(nextSection.id);
            setCurrentQuestionId(
                offset === 1 ? nextSection.questionIds[0] : nextSection.questionIds[nextSection.questionIds.length - 1],
            );
        },
        [currentQuestionId, currentSectionId, submittedSections],
    );

    const handleAnswerChange = useCallback(
        (answer: string[]) => {
            setAnswers((prev) => ({ ...prev, [currentQuestionId]: answer }));
        },
        [currentQuestionId],
    );

    const handleSubmitNext = useCallback(
        (answer: string[]) => {
            setAnswers((prev) => ({ ...prev, [currentQuestionId]: answer }));
            const section = PRACTICE_SECTIONS.find((s) => s.id === currentSectionId);
            if (!section) return;
            if (section.questionIds.indexOf(currentQuestionId) === section.questionIds.length - 1) {
                setIsSubmitViewOpen(true);
                return;
            }
            goToOffset(1);
        },
        [currentQuestionId, currentSectionId, goToOffset],
    );

    const toggleReview = useCallback(() => {
        setReviewFlags((prev) => {
            const next = new Set(prev);
            if (next.has(currentQuestionId)) next.delete(currentQuestionId);
            else next.add(currentQuestionId);
            return next;
        });
    }, [currentQuestionId]);

    const handleSubmitSection = useCallback(
        (sectionId: string) => {
            const next = new Set(submittedSections);
            next.add(sectionId);
            setSubmittedSections(next);

            const remaining = PRACTICE_SECTIONS.find((s) => !next.has(s.id));
            if (!remaining) {
                setIsFinished(true);
                return;
            }
            setIsSubmitViewOpen(false);
            setCurrentSectionId(remaining.id);
            setCurrentQuestionId(remaining.questionIds[0]);
        },
        [submittedSections],
    );

    const handleSubmitExam = useCallback(() => {
        setSubmittedSections(new Set(PRACTICE_SECTIONS.map((s) => s.id)));
        setIsFinished(true);
    }, []);

    const restartPractice = useCallback(() => {
        try {
            sessionStorage.removeItem(DRAFT_KEY);
        } catch {
            /* ignore */
        }
        setAnswers({});
        setReviewFlags(new Set());
        setSubmittedSections(new Set());
        setCurrentSectionId('ps1');
        setCurrentQuestionId('pq1');
        setIsSubmitViewOpen(false);
        setIsFinished(false);
        setTimeLeft(PRACTICE_DURATION_SECONDS);
    }, []);

    const score = useMemo(() => {
        const questionIds = Object.keys(PRACTICE_QUESTIONS);
        const correct = questionIds.filter((qid) => {
            const expected = (PRACTICE_QUESTIONS[qid].mcqOptions || [])
                .filter((o) => o.isCorrect)
                .map((o) => o.id)
                .sort();
            const given = [...(answers[qid] || [])].sort();
            return expected.length > 0 && expected.length === given.length && expected.every((v, i) => v === given[i]);
        }).length;
        return { correct, total: questionIds.length };
    }, [answers]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const examConfig: ExamConfig = {
        rollNumber: 'PRACTICE-001',
        userName: 'Practice Run',
        hideBrandSuffix: true,
        hideBrandName: true,
        leftContent: (
            <div className="ml-4 flex items-center gap-2" data-tour="practice-badge">
                <button
                    onClick={startGuide}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-95"
                    title="Replay the guided tour"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                    </svg>
                    Guide
                </button>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 sm:inline-flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Practice Mode · Not Recorded
                </span>
                <div
                    data-tour="practice-focus"
                    className={`flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-1.5 transition-shadow duration-300 ${
                        windowFocus.in === 0 && windowFocus.out === 0 ? 'shadow-none' : 'shadow-md shadow-slate-200/50'
                    }`}
                    title="Tab/window switches — real exams record these"
                >
                    <div className="flex items-center gap-1.5" title="Switched In (Focused)">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                        </div>
                        <span className="text-xs font-black text-emerald-700">{windowFocus.in}</span>
                    </div>
                    <div className="h-3 w-[1px] bg-slate-100" />
                    <div className="flex items-center gap-1.5" title="Switched Out (Blurred)">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </div>
                        <span className="text-xs font-black text-rose-700">{windowFocus.out}</span>
                    </div>
                </div>
            </div>
        ),
        centerContent: isSubmitViewOpen ? (
            !submittedSections.has(currentSectionId) ? (
                <button
                    onClick={() => setIsSubmitViewOpen(false)}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
                >
                    Back to Questions
                </button>
            ) : null
        ) : (
            <button
                data-tour="practice-submit"
                onClick={() => setIsSubmitViewOpen(true)}
                className="rounded-xl bg-[var(--brand)] px-8 py-2 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
            >
                Submit Section
            </button>
        ),
        rightContent: (
            <div className="flex items-center gap-3">
                <div
                    data-tour="practice-timer"
                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black transition-all duration-500 ${
                        timeLeft <= 300
                            ? 'animate-pulse border-rose-100 bg-rose-50 text-rose-600'
                            : 'border-sky-100 bg-sky-50 text-sky-700'
                    }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatTime(timeLeft)}
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-white p-1">
                    <button
                        onClick={() => setFontSize((prev) => Math.max(12, prev - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-[var(--brand)]"
                        aria-label="Decrease font size"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setFontSize((prev) => Math.min(30, prev + 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-[var(--brand)]"
                        aria-label="Increase font size"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
        ),
    };

    if (isFinished) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-5">
                <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-12 animate-in fade-in zoom-in-95 duration-500">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-4xl">
                        🎉
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Practice Complete</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                        You know your way around now
                    </h1>
                    <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-6 text-slate-500">
                        You got <span className="font-black text-slate-900">{score.correct}</span> of{' '}
                        <span className="font-black text-slate-900">{score.total}</span> orientation questions right.
                        Nothing was recorded — real exams will look and behave exactly like this.
                    </p>
                    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                        <button
                            onClick={restartPractice}
                            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
                        >
                            Practice Again
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/learner')}
                            className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-slate-800"
                        >
                            Go to My Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-white">
            <Navbar examConfig={examConfig} />

            {/* Tab-switch coaching banner — mirrors what a real exam would log.
                z-index sits above driver.js's 1000000000 overlay so the warning
                stays readable even mid-tour. */}
            {focusAlert && (
                <div className="fixed left-1/2 top-16 z-[1000000001] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 animate-in fade-in slide-in-from-top-3 duration-300">
                    <div
                        className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md ${
                            focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT
                                ? 'border-rose-200 bg-rose-50/95'
                                : 'border-amber-200 bg-amber-50/95'
                        }`}
                        role="alert"
                    >
                        <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT
                                    ? 'bg-rose-100 text-rose-600'
                                    : 'bg-amber-100 text-amber-600'
                            }`}
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4
                                className={`text-xs font-black uppercase tracking-wider ${
                                    focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT ? 'text-rose-800' : 'text-amber-800'
                                }`}
                            >
                                {focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT
                                    ? 'You would have been removed'
                                    : `Tab switch detected — ${focusAlert.outCount} of ${TAB_SWITCH_DEMO_LIMIT}`}
                            </h4>
                            <p
                                className={`mt-1 text-xs font-semibold leading-5 ${
                                    focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT ? 'text-rose-700' : 'text-amber-700'
                                }`}
                            >
                                {focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT
                                    ? `That's ${focusAlert.outCount} switches. A real exam with a limit of ${TAB_SWITCH_DEMO_LIMIT} would have ended your session automatically. Here it's just practice — but treat the exam tab as home.`
                                    : 'In a real exam every switch away from this tab is recorded and reported to your instructor. Passing the limit can end your exam automatically.'}
                            </p>
                        </div>
                        <button
                            onClick={() => setFocusAlert(null)}
                            className={`shrink-0 rounded-lg p-1 transition-colors ${
                                focusAlert.outCount >= TAB_SWITCH_DEMO_LIMIT
                                    ? 'text-rose-400 hover:bg-rose-100 hover:text-rose-700'
                                    : 'text-amber-400 hover:bg-amber-100 hover:text-amber-700'
                            }`}
                            aria-label="Dismiss warning"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex flex-1 overflow-hidden">
                {isSubmitViewOpen || submittedSections.has(currentSectionId) ? (
                    <ExamSubmitView
                        sections={sidebarSections}
                        currentSectionId={currentSectionId}
                        onClose={() => setIsSubmitViewOpen(false)}
                        onSubmitSection={handleSubmitSection}
                        onSubmitExam={handleSubmitExam}
                        isSubmitting={false}
                        onQuestionClick={(sid, qid) => {
                            handleQuestionSelect(sid, qid);
                            setIsSubmitViewOpen(false);
                        }}
                    />
                ) : (
                    <>
                        <div className="flex h-full" data-tour="practice-sidebar">
                            <ExamSidebar
                                sections={sidebarSections}
                                currentSectionId={currentSectionId}
                                currentQuestionId={currentQuestionId}
                                onQuestionSelect={handleQuestionSelect}
                                collapsed={sidebarCollapsed}
                                hidden={sidebarHidden}
                                onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
                                onToggleHidden={() => setSidebarHidden((prev) => !prev)}
                            />
                        </div>

                        <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
                            <div className="h-full w-full flex-1 overflow-hidden">
                                {currentQuestion && (
                                    <UnitRenderer
                                        question={currentQuestion}
                                        activeTab="question"
                                        hideNav={true}
                                        hideTabs={true}
                                        showSidebarToggle={false}
                                        isExamMode={true}
                                        contentFontSize={fontSize}
                                        onToggleReview={toggleReview}
                                        isMarkedForReview={reviewFlags.has(currentQuestionId)}
                                        onAnswerChange={handleAnswerChange}
                                        onPrevious={() => goToOffset(-1)}
                                        onNext={() => goToOffset(1)}
                                        onSubmit={handleSubmitNext}
                                        currentAnswer={answers[currentQuestionId]}
                                    />
                                )}
                            </div>
                        </main>
                    </>
                )}
            </div>

        </div>
    );
}
