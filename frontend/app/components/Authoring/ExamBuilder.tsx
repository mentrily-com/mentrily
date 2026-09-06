'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { TeacherService } from '@/services/api/TeacherService';
import {
    Plus,
    Layout,
    Settings,
    Share2,
    GripVertical,
    ChevronRight,
    Code,
    Globe,
    HelpCircle,
    CheckCircle2,
    BarChart3,
    Sparkles,
    Trash2,
    Clock,
    Target,
    Eye,
    EyeOff,
    TerminalSquare,
    PanelLeftClose,
    PanelLeftOpen,
    Lock,
    RotateCcw,
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
    useSortable,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Course as Exam, Section, Question } from './types';
import QuestionBuilder from './QuestionBuilder/QuestionBuilder';
import { siteConfig } from '@/app/config/site';
import StudentPreview from './StudentPreview';
import AlertModal from '../Common/AlertModal';
import { useToast } from '../Common/Toast';
import DashboardSkeleton from '../Skeletons/DashboardSkeleton';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from '../Common/UpgradeModal';
import AiGenerateModal from './AiGenerateModal';
import { getAvailableImportTypes } from './aiImport';
import {
    getAllTimeZones,
    detectTimeZone,
    zonedWallClockToUtcISO,
    utcISOToZonedWallClock,
    zoneLabel,
} from '@/lib/timezone';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
    ssr: false,
    loading: () => <DashboardSkeleton type="form" noNavbar />,
});

const createDefaultExam = (): Partial<Exam> => ({
    title: '',
    shortDescription: '',
    longDescription: '',
    difficulty: 'Intermediate',
    tags: [],
    isVisible: false,
    sections: [
        {
            id: 'sec-1',
            title: 'Core Assessment',
            questions: [],
        },
    ],
});

export default function ExamBuilder({
    initialData,
    onDelete,
    basePath,
    courseId,
    userRole,
    orgPermissions = { allowAppExams: true, allowAIProctoring: true },
    organizationId,
}: {
    initialData?: Partial<Exam>;
    onDelete?: () => void;
    basePath?: string;
    courseId?: string;
    userRole?: 'admin' | 'teacher' | 'super-admin';
    orgPermissions?: { allowAppExams?: boolean; allowAIProctoring?: boolean; teacherSelfBilling?: boolean };
    organizationId?: string;
}) {
    const { success, error } = useToast();
    const router = useRouter();
    const [exam, setExam] = useState<Partial<Exam>>(initialData || createDefaultExam());

    // Full global IANA zone list (every country/continent), computed once.
    const [timeZoneOptions] = useState<string[]>(() => getAllTimeZones());
    const [scheduleTz, setScheduleTz] = useState<string>((initialData as any)?.timeZone || detectTimeZone());

    // Changing the zone keeps the wall-clock the creator typed and reinterprets
    // it in the new zone (so "3:00 PM" stays "3:00 PM", the stored UTC instant
    // shifts). scheduleTz here is still the previous zone inside the updater.
    const handleTimeZoneChange = (tz: string) => {
        setExam((prev) => {
            const next: Partial<Exam> = { ...prev, timeZone: tz };
            if (prev.startTime) {
                const wall = utcISOToZonedWallClock(prev.startTime, scheduleTz);
                next.startTime = zonedWallClockToUtcISO(wall, tz);
            }
            if (prev.endTime) {
                const wall = utcISOToZonedWallClock(prev.endTime, scheduleTz);
                next.endTime = zonedWallClockToUtcISO(wall, tz);
            }
            return next;
        });
        setScheduleTz(tz);
    };

    const [activeSectionId, setActiveSectionId] = useState<string>('sec-1');
    const [activeStep, setActiveStep] = useState<'metadata' | 'builder'>('builder');
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [upgradeConfig, setUpgradeConfig] = useState<{ isOpen: boolean; title: string; message: string }>({
        isOpen: false,
        title: 'Upgrade Required',
        message: '',
    });
    const { canUse } = usePlan();
    const isCourseLinked = Boolean(courseId || initialData?.linkedCourseId || exam.linkedCourseId);
    const canCustomSlug = canUse('customSlug');

    const initialExamId = initialData?.id;
    const isEditMode = Boolean(initialExamId);
    const getDraftKey = () => (initialExamId ? `exam_builder_draft_${initialExamId}` : 'exam_builder_draft_new');

    // Persistence: Load from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const key = getDraftKey();
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const draftData = isEditMode
                        ? parsed
                        : (() => {
                              const { id, slug, inviteToken, ...rest } = parsed || {};
                              return rest;
                          })();

                    setExam((prev) => ({ ...prev, ...draftData }));
                    success('Restored exam draft from local storage', 'Draft Restored');
                } catch (e) {
                    console.error('Failed to load exam draft', e);
                }
            }
        }
    }, []);

    // Persistence: Save to localStorage on change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const key = getDraftKey();
            const timeout = setTimeout(() => {
                const draftToSave = isEditMode
                    ? exam
                    : (() => {
                          const { id, ...rest } = exam as any;
                          return rest;
                      })();

                localStorage.setItem(key, JSON.stringify(draftToSave));
            }, 1000); // Debounce 1s
            return () => clearTimeout(timeout);
        }
    }, [exam, isEditMode]);

    const activeSection = exam.sections?.find((s) => s.id === activeSectionId);
    const activeQuestion = activeSection?.questions.find((q) => q.id === activeQuestionId);

    const addSection = () => {
        const newSection: Section = {
            id: `sec-${Date.now()}`,
            title: 'New Section',
            questions: [],
        };
        setExam((prev) => ({ ...prev, sections: [...(prev.sections || []), newSection] }));
        setActiveSectionId(newSection.id);
    };

    const renameSection = (sectionId: string, title: string) => {
        setExam((prev) => ({
            ...prev,
            sections: prev.sections?.map((section) => (section.id === sectionId ? { ...section, title } : section)),
        }));
    };

    const addQuestion = (type: Question['type']) => {
        if (!activeSection) return;
        const newQuestion: Question = {
            id: `q-${Date.now()}`,
            type,
            title: `New ${type} Question`,
            problemStatement: '',
            marks: 10,
            difficulty: 'Medium',
            tags: [],
            options:
                type === 'MCQ' || type === 'MultiSelect'
                    ? [
                          { id: `opt-1`, text: 'Option 1', isCorrect: true },
                          { id: `opt-2`, text: 'Option 2', isCorrect: false },
                      ]
                    : [],
            codingConfig:
                type === 'Coding'
                    ? {
                          templates: {
                              javascript: { head: '', body: '// Write your code here', tail: '', solution: '' },
                              python: { head: '', body: '# Write your code here', tail: '', solution: '' },
                          },
                          testCases: [],
                          showTestCases: false,
                      }
                    : undefined,
            webConfig:
                type === 'Web'
                    ? {
                          html: '<h1>Hello World</h1>',
                          css: 'body { color: blue; }',
                          js: '',
                          showFiles: { html: true, css: true, js: true },
                          testCases: [],
                      }
                    : undefined,
            notebookConfig:
                type === 'Notebook'
                    ? {
                          initialCode:
                              '# Write your Python code here\\nimport numpy as np\\nimport matplotlib.pyplot as plt\\n\\nprint("Hello from Python Notebook!")',
                          language: 'python',
                          maxExecutionTime: 10,
                          allowedLibraries: ['numpy', 'matplotlib'],
                      }
                    : undefined,
        };

        setExam((prev) => ({
            ...prev,
            sections: prev.sections?.map((s) =>
                s.id === activeSectionId ? { ...s, questions: [...s.questions, newQuestion] } : s,
            ),
        }));
        setActiveQuestionId(newQuestion.id);
        setShowAddMenu(null);
    };

    const openUpgrade = (message: string, title = 'Upgrade Required') => {
        setUpgradeConfig({ isOpen: true, title, message });
    };

    const teacherSelfBillingEnabled = orgPermissions?.teacherSelfBilling !== false;
    const upgradePath =
        userRole === 'teacher'
            ? teacherSelfBillingEnabled
                ? '/dashboard/creator/billing'
                : null
            : '/dashboard/creator/billing';

    const deleteSection = (sectionId: string) => {
        setAlertConfig({
            isOpen: true,
            title: 'Delete Section?',
            message: 'Are you sure you want to delete this assessment section? All questions in it will be lost.',
            onConfirm: () => {
                setExam((prev) => ({
                    ...prev,
                    sections: prev.sections?.filter((s) => s.id !== sectionId),
                }));
                if (activeSectionId === sectionId) {
                    setActiveSectionId(exam.sections?.find((s) => s.id !== sectionId)?.id || '');
                }
                setAlertConfig((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    const deleteQuestion = (sectionId: string, questionId: string) => {
        setAlertConfig({
            isOpen: true,
            title: 'Delete Question?',
            message: 'This question will be permanently removed from the exam.',
            onConfirm: () => {
                setExam((prev) => ({
                    ...prev,
                    sections: prev.sections?.map((s) =>
                        s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
                    ),
                }));
                if (activeQuestionId === questionId) setActiveQuestionId(null);
                setAlertConfig((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Single DndContext covers both the section list and, nested inside each
    // expanded section, its question list — dnd-kit supports nested
    // SortableContexts under one DndContext, so drag type (section vs
    // question) is disambiguated via the dragged item's `data`.
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const activeData = active.data.current as { type?: string; sectionId?: string } | undefined;

        if (activeData?.type === 'section') {
            setExam((prev) => {
                const sections = prev.sections || [];
                const oldIndex = sections.findIndex((s) => s.id === active.id);
                const newIndex = sections.findIndex((s) => s.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return { ...prev, sections: arrayMove(sections, oldIndex, newIndex) };
            });
            return;
        }

        if (activeData?.type === 'question' && activeData.sectionId) {
            const sectionId = activeData.sectionId;
            setExam((prev) => ({
                ...prev,
                sections: prev.sections?.map((s) => {
                    if (s.id !== sectionId) return s;
                    const oldIndex = s.questions.findIndex((q) => q.id === active.id);
                    const newIndex = s.questions.findIndex((q) => q.id === over.id);
                    if (oldIndex === -1 || newIndex === -1) return s;
                    return { ...s, questions: arrayMove(s.questions, oldIndex, newIndex) };
                }),
            }));
        }
    };

    const resetDraft = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(getDraftKey());
        }

        const nextExam = initialData || createDefaultExam();
        setExam(nextExam);
        setActiveSectionId(nextExam.sections?.[0]?.id || 'sec-1');
        setActiveQuestionId(null);
        setShowAddMenu(null);
        setPreviewMode(null);
        success('Draft reset successfully', 'Draft Reset');
    };

    const totalSections = exam.sections?.length || 0;
    const totalQuestions = (exam.sections || []).reduce((sum, section) => sum + section.questions.length, 0);
    const accessRulesCount =
        Number(Boolean(exam.testCode)) + Number(Boolean(exam.allowedIPs)) + Number(Boolean(exam.inviteToken));
    const activeQuestionCount = activeSection?.questions.length || 0;
    const workspaceLabel =
        activeStep === 'metadata' ? 'Exam settings' : activeQuestion ? 'Question editor' : 'Section builder';
    const builderStats = [
        { label: 'Sections', value: totalSections },
        { label: 'Questions', value: totalQuestions },
        { label: 'Access rules', value: accessRulesCount },
        { label: 'In section', value: activeQuestionCount },
    ];

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <div className="sticky top-0 z-40 border-b border-slate-200 glass-card">
                {/* Unified Toolbar */}
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <button
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-[var(--brand)]"
                            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        >
                            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                        </button>
                        <span className="hidden lg:inline-flex shrink-0 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                            Exam Builder
                        </span>
                        <input
                            type="text"
                            aria-label="Exam title"
                            placeholder="Exam Title..."
                            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-[var(--brand-light)] focus:bg-slate-50 md:text-base"
                            value={exam.title}
                            onChange={(e) => setExam((prev) => ({ ...prev, title: e.target.value }))}
                        />
                        <button
                            type="button"
                            onClick={() =>
                                setExam(
                                    (prev) =>
                                        ({
                                            ...prev,
                                            isVisible: !prev.isVisible,
                                            isActive: !prev.isVisible,
                                        }) as any,
                                )
                            }
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] cursor-pointer transition-colors ${exam.isVisible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${exam.isVisible ? 'bg-emerald-500' : 'bg-slate-400'}`}
                            />
                            <span className="hidden sm:inline">{exam.isVisible ? 'Published' : 'Draft'}</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 md:gap-2">
                        <button
                            onClick={resetDraft}
                            className="cursor-pointer rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                            title="Reset local draft"
                        >
                            <RotateCcw size={16} />
                        </button>
                        {onDelete && (
                            <button
                                onClick={() =>
                                    setAlertConfig({
                                        isOpen: true,
                                        title: 'Delete Exam?',
                                        message: 'Are you sure you want to delete this exam? This action is permanent.',
                                        onConfirm: onDelete,
                                    })
                                }
                                className="cursor-pointer rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                title="Delete exam"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => setPreviewMode(previewMode ? null : 'desktop')}
                            disabled={!activeQuestion}
                            className={`cursor-pointer rounded-xl p-2.5 transition-colors disabled:opacity-30 ${previewMode ? 'bg-[var(--brand)] text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-[var(--brand)]'}`}
                            title={
                                activeQuestion
                                    ? previewMode
                                        ? 'Close preview'
                                        : 'Preview question'
                                    : 'Select a question first'
                            }
                        >
                            {previewMode ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <div className="mx-1 h-5 w-px bg-slate-200" />
                        <button
                            onClick={() => {
                                setShowComingSoon(true);
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand-light)]/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--brand)] transition-colors hover:bg-[var(--brand-light)]/50"
                        >
                            <Sparkles size={14} />
                            <span className="hidden sm:inline">AI Generate</span>
                        </button>
                        <button
                            onClick={async () => {
                                setIsSaving(true);
                                try {
                                    if (exam.id) {
                                        const payload = { ...exam } as any;
                                        // Backend expects sections array; questions may be a JSON object from API.
                                        delete payload.questions;
                                        await TeacherService.updateExam(exam.id, payload);
                                        success('Exam updated successfully!', 'Saved');
                                    } else {
                                        const payload = courseId
                                            ? ({ ...(exam as any), linkedCourseId: courseId } as any)
                                            : exam;
                                        const res = await TeacherService.createExam(payload, organizationId);
                                        setExam((prev) => ({ ...prev, id: res.id }));

                                        if (courseId) {
                                            try {
                                                await TeacherService.linkExamToCourse(courseId, res.id, {
                                                    examUnlockThreshold: 100,
                                                    examPassThreshold: 60,
                                                });
                                            } catch (linkError) {
                                                console.error(
                                                    'Failed to link exam to course after creation',
                                                    linkError,
                                                );
                                            }
                                        }

                                        if (typeof window !== 'undefined') {
                                            localStorage.removeItem('exam_builder_draft_new');
                                        }
                                        success('Exam created successfully!', 'Saved');
                                        if (courseId) {
                                            router.push(`/dashboard/creator/courses/${courseId}/edit`);
                                        }
                                    }
                                } catch (e) {
                                    console.error(e);
                                    alert(e instanceof Error && e.message ? e.message : 'Failed to save exam');
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            className="flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-[var(--brand)]/20 transition-all hover:brightness-110 disabled:opacity-50"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Share2 size={16} />
                            )}
                            <span className="hidden sm:inline">{exam.id ? 'Update Exam' : 'Save Exam'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative bg-[linear-gradient(180deg,_rgba(248,250,252,0.94),_rgba(255,255,255,1))]">
                {/* Sidebar Overlay (Mobile) */}
                {!isSidebarCollapsed && (
                    <div
                        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden animate-in fade-in"
                        onClick={() => setIsSidebarCollapsed(true)}
                    />
                )}
                {/* Left Sidebar: Sidebar Structure */}
                <div
                    className={`flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50/95 backdrop-blur-xl transition-all duration-300 ease-in-out absolute inset-y-0 left-0 z-50 lg:relative lg:bg-slate-50/60 ${isSidebarCollapsed ? 'w-0 border-none -translate-x-full lg:translate-x-0' : 'w-[280px] sm:w-80 translate-x-0 shadow-2xl lg:shadow-none'}`}
                >
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            <span>
                                <span className="text-slate-900 font-bold">{totalSections}</span> sec
                            </span>
                            <span className="h-3 w-px bg-slate-200" />
                            <span>
                                <span className="text-slate-900 font-bold">{totalQuestions}</span> qs
                            </span>
                            <span className="h-3 w-px bg-slate-200" />
                            <span>
                                <span className="text-slate-900 font-bold">{accessRulesCount}</span> rules
                            </span>
                            <span className="h-3 w-px bg-slate-200" />
                            <span>
                                <span className="text-[var(--brand)] font-bold">{activeQuestionCount}</span> active
                            </span>
                        </div>
                    </div>

                    <div className="border-b border-slate-200 bg-white px-4 py-2.5">
                        <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
                            <button
                                onClick={() => setActiveStep('builder')}
                                className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeStep === 'builder' ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Layout size={11} /> Structure
                            </button>
                            <button
                                onClick={() => setActiveStep('metadata')}
                                className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeStep === 'metadata' ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Settings size={11} /> Guidelines
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                        {activeStep === 'builder' ? (
                            <>
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
                                    Exam Sections
                                    <button
                                        onClick={addSection}
                                        aria-label="Add exam section"
                                        className="text-[var(--brand)] hover:scale-110 transition-transform"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                    </button>
                                </h3>

                                <DndContext
                                    sensors={dndSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={(exam.sections || []).map((s) => s.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-4">
                                            {exam.sections?.map((section) => (
                                                <SectionRow
                                                    key={section.id}
                                                    section={section}
                                                    isActive={activeSectionId === section.id}
                                                    onSelect={() => setActiveSectionId(section.id)}
                                                    onRename={(title) => renameSection(section.id, title)}
                                                    onDelete={() => deleteSection(section.id)}
                                                    activeQuestionId={activeQuestionId}
                                                    onSelectQuestion={(id) => setActiveQuestionId(id)}
                                                    onDeleteQuestion={(id) => deleteQuestion(section.id, id)}
                                                    showAddMenu={showAddMenu === section.id}
                                                    onToggleAddMenu={() =>
                                                        setShowAddMenu(showAddMenu === section.id ? null : section.id)
                                                    }
                                                    onAddQuestion={addQuestion}
                                                    canUse={canUse}
                                                    openUpgrade={openUpgrade}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">
                                    Exam Settings
                                </h3>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                                    <div className="w-12 h-12 bg-[var(--brand-light)] text-[var(--brand)] rounded-xl flex items-center justify-center">
                                        <BarChart3 size={20} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-800 uppercase leading-tight">
                                        Configure the global rules and instructions for this exam.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="relative flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,_rgba(248,250,252,0.52),_rgba(255,255,255,1))]">
                    {previewMode ? (
                        <StudentPreview question={activeQuestion} mode={previewMode} setMode={setPreviewMode} />
                    ) : activeStep === 'metadata' ? (
                        <div className="flex-1 overflow-y-auto p-5 md:p-6 animate-in fade-in slide-in-from-right-4 duration-500 bg-slate-50/20">
                            <div className="mx-auto max-w-5xl space-y-5">
                                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                        Delivery setup
                                    </p>
                                    <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                                        Configure timing, access, and security in one pass.
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        This view keeps the high-stakes details together so publishing stays predictable
                                        for both teachers and admins.
                                    </p>
                                </div>

                                {/* Section: Primary Info */}
                                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--brand-light)] text-[var(--brand)] flex items-center justify-center">
                                                <Layout size={18} />
                                            </div>
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                                                Basic Information
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`text-[10px] font-black uppercase tracking-widest ${exam.isVisible ? 'text-emerald-500' : 'text-slate-400'}`}
                                            >
                                                {exam.isVisible ? 'Published' : 'Draft'}
                                            </span>
                                            <VisibilityToggle
                                                active={exam.isVisible || false}
                                                onClick={() =>
                                                    setExam((prev) => ({ ...prev, isVisible: !prev.isVisible }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Exam Title
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[var(--brand-light)] transition-all"
                                                placeholder="e.g. JavaScript Midterm"
                                                value={exam.title}
                                                onChange={(e) =>
                                                    setExam((prev) => ({ ...prev, title: e.target.value }))
                                                }
                                            />
                                        </div>
                                        {!isCourseLinked && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    URL Slug
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        readOnly={!canCustomSlug}
                                                        onClick={() => {
                                                            if (!canCustomSlug) {
                                                                openUpgrade(
                                                                    'Custom exam URLs are available on Enterprise.',
                                                                );
                                                            }
                                                        }}
                                                        className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-[var(--brand)] outline-none transition-all ${canCustomSlug ? 'focus:border-[var(--brand-light)]' : 'cursor-pointer'}`}
                                                        placeholder={
                                                            exam.id
                                                                ? exam.slug || 'Auto-generated after save'
                                                                : 'Auto-generated on save'
                                                        }
                                                        value={exam.slug}
                                                        onChange={(e) =>
                                                            canCustomSlug &&
                                                            setExam((prev) => ({ ...prev, slug: e.target.value }))
                                                        }
                                                    />
                                                </div>
                                                <p className="text-[9px] font-medium text-slate-400">
                                                    {canCustomSlug
                                                        ? 'Public URL identifier. Leave empty to auto-generate.'
                                                        : 'Auto-generated on save. Enterprise unlocks custom URLs.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Description
                                        </label>
                                        <RichTextEditor
                                            content={exam.longDescription || ''}
                                            onChange={(content) =>
                                                setExam((prev) => ({ ...prev, longDescription: content }))
                                            }
                                        />
                                    </div>
                                </div>

                                {!isCourseLinked ? (
                                    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                                <Clock size={18} />
                                            </div>
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                                                Scheduling & Duration
                                            </h3>
                                        </div>

                                        <div className="space-y-1.5 mb-6">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Exam Timezone
                                            </label>
                                            <select
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-[var(--brand-light)] transition-all"
                                                value={scheduleTz}
                                                onChange={(e) => handleTimeZoneChange(e.target.value)}
                                            >
                                                {timeZoneOptions.map((tz) => (
                                                    <option key={tz} value={tz}>
                                                        {zoneLabel(tz)}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] font-semibold text-slate-400">
                                                Start &amp; end times below are in this timezone. Learners anywhere see
                                                the exam open at the same moment, labeled in their own zone.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Start Time
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-[var(--brand-light)] transition-all"
                                                    value={utcISOToZonedWallClock(exam.startTime || '', scheduleTz)}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            timeZone: scheduleTz,
                                                            startTime: e.target.value
                                                                ? zonedWallClockToUtcISO(e.target.value, scheduleTz)
                                                                : undefined,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    End Time
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-[var(--brand-light)] transition-all"
                                                    value={utcISOToZonedWallClock(exam.endTime || '', scheduleTz)}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            timeZone: scheduleTz,
                                                            endTime: e.target.value
                                                                ? zonedWallClockToUtcISO(e.target.value, scheduleTz)
                                                                : undefined,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Duration (Mins)
                                                </label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-slate-700 outline-none focus:border-[var(--brand-light)] transition-all"
                                                    placeholder="60"
                                                    value={exam.duration}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            duration: parseInt(e.target.value),
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Total Marks
                                                </label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-[var(--brand)] outline-none focus:border-[var(--brand-light)] transition-all"
                                                    placeholder="100"
                                                    value={exam.totalMarks}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            totalMarks: parseInt(e.target.value),
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                                                <Target size={18} />
                                            </div>
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                                                Course Exam Settings
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Passing Percentage
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-slate-700 outline-none focus:border-[var(--brand-light)] transition-all"
                                                    value={exam.passingPercentage ?? 70}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            passingPercentage: Number(e.target.value || 70),
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Max Attempts
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-slate-700 outline-none focus:border-[var(--brand-light)] transition-all"
                                                    value={exam.maxAttempts ?? 1}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            maxAttempts: Number(e.target.value || 1),
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Attempt Buffer (mins)
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-slate-700 outline-none focus:border-[var(--brand-light)] transition-all"
                                                    value={exam.attemptBufferMins ?? 0}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            attemptBufferMins: Number(e.target.value || 0),
                                                        }))
                                                    }
                                                />
                                                <p className="text-[9px] font-medium text-slate-400">
                                                    Wait time before next attempt.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!isCourseLinked && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <Target size={18} />
                                                </div>
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                                                    Test Code Authentication
                                                </h3>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Test Code (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black tracking-[0.3em] text-[var(--brand)] outline-none focus:border-[var(--brand-light)] transition-all"
                                                    placeholder="00000"
                                                    value={exam.testCode}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({ ...prev, testCode: e.target.value }))
                                                    }
                                                />
                                                <p className="text-[9px] font-medium text-slate-400">
                                                    Required code to enter the exam.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        Code Rotation Type
                                                    </label>
                                                    <div className="flex gap-2 p-1 bg-slate-50 rounded-xl">
                                                        {['Permanent', 'Rotating'].map((t) => (
                                                            <button
                                                                key={t}
                                                                onClick={() =>
                                                                    setExam((prev) => ({
                                                                        ...prev,
                                                                        testCodeType: t as any,
                                                                    }))
                                                                }
                                                                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${exam.testCodeType === t ? 'bg-white text-[var(--brand)] shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                            >
                                                                {t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {exam.testCodeType === 'Rotating' && (
                                                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            Rotation Interval (Mins)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-[var(--brand)] outline-none focus:border-[var(--brand-light)]"
                                                            placeholder="60"
                                                            value={exam.rotationInterval}
                                                            onChange={(e) =>
                                                                setExam((prev) => ({
                                                                    ...prev,
                                                                    rotationInterval: parseInt(e.target.value),
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                <p className="text-[9px] font-bold text-slate-400">
                                                    Current Code:{' '}
                                                    <span className="text-[var(--brand)]">
                                                        {exam.testCode || '00000'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                    <Globe size={18} />
                                                </div>
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                                                    Access Control
                                                </h3>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        Allowed IP Addr
                                                    </label>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch(
                                                                    'https://api.ipify.org?format=json',
                                                                );
                                                                const data = await res.json();
                                                                setExam((prev) => {
                                                                    const currentIps = prev.allowedIPs
                                                                        ? prev.allowedIPs.trim()
                                                                        : '';
                                                                    const newIps = currentIps
                                                                        ? `${currentIps}, ${data.ip}`
                                                                        : data.ip;
                                                                    return { ...prev, allowedIPs: newIps };
                                                                });
                                                                success('IP Address copied and added!', 'Success');
                                                            } catch (err) {
                                                                console.error('Failed to fetch IP', err);
                                                                alert('Failed to fetch your IP address');
                                                            }
                                                        }}
                                                        className="text-[8px] font-black uppercase text-[var(--brand)] hover:underline"
                                                    >
                                                        Copy My IP
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-[var(--brand-light)] transition-all font-mono"
                                                    placeholder="e.g. 192.168.1.1, 10.0.0.1"
                                                    value={exam.allowedIPs || ''}
                                                    onChange={(e) =>
                                                        setExam((prev) => ({ ...prev, allowedIPs: e.target.value }))
                                                    }
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Invite Token
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none cursor-default"
                                                        value={exam.inviteToken || 'xqoto373'}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setExam((prev) => ({
                                                                ...prev,
                                                                inviteToken: Math.random().toString(36).substring(7),
                                                            }))
                                                        }
                                                        title="Generate Random Token"
                                                        className="cursor-pointer rounded-xl bg-slate-100 p-2.5 text-slate-400 transition-all hover:bg-slate-200"
                                                    >
                                                        <Sparkles size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const inviteLink = `${siteConfig.domain}/invite/${exam.inviteToken || 'xqoto373'}`;
                                                            try {
                                                                await navigator.clipboard.writeText(inviteLink);
                                                                success('Invite link copied to clipboard', 'Copied');
                                                            } catch (copyError) {
                                                                console.error('Failed to copy invite link', copyError);
                                                                error(
                                                                    'Unable to copy invite link right now.',
                                                                    'Copy Failed',
                                                                );
                                                            }
                                                        }}
                                                        className="cursor-pointer rounded-xl bg-slate-100 p-2.5 text-slate-400 transition-all hover:bg-slate-200"
                                                        title="Copy invite link"
                                                    >
                                                        <Share2 size={16} />
                                                    </button>
                                                </div>
                                                <p className="text-[9px] font-bold text-[var(--brand)] truncate">
                                                    {siteConfig.domain}/invite/{exam.inviteToken || 'xqoto373'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section: Monitoring & Security */}
                                <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                                            <Settings size={18} />
                                        </div>
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800">
                                            Monitoring & Security
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Exam Mode
                                            </label>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() =>
                                                        setExam((prev) => ({ ...prev, examMode: 'Browser' }))
                                                    }
                                                    className={`flex-1 p-4 rounded-2xl border transition-all text-left ${exam.examMode === 'Browser' ? 'border-[var(--brand)] bg-[var(--brand-light)]/50' : 'border-slate-100 hover:border-slate-200'}`}
                                                >
                                                    <p
                                                        className={`text-[10px] font-black uppercase tracking-widest ${exam.examMode === 'Browser' ? 'text-[var(--brand)]' : 'text-slate-400'}`}
                                                    >
                                                        Browser
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1">
                                                        Standard web assessment.
                                                    </p>
                                                </button>
                                                {orgPermissions.allowAppExams && (
                                                    <button
                                                        onClick={() =>
                                                            setExam((prev) => ({ ...prev, examMode: 'App' }))
                                                        }
                                                        className={`flex-1 p-4 rounded-2xl border transition-all text-left ${exam.examMode === 'App' ? 'border-[var(--brand)] bg-[var(--brand-light)]/50' : 'border-slate-100 hover:border-slate-200'}`}
                                                    >
                                                        <p
                                                            className={`text-[10px] font-black uppercase tracking-widest ${exam.examMode === 'App' ? 'text-[var(--brand)]' : 'text-slate-400'}`}
                                                        >
                                                            App (Secure)
                                                        </p>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1">
                                                            Electron locked app only.
                                                        </p>
                                                    </button>
                                                )}
                                                {!orgPermissions.allowAppExams && (
                                                    <div className="flex-1 p-4 rounded-2xl border border-slate-50 bg-slate-50 opacity-40 cursor-not-allowed">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                                            App (Locked)
                                                        </p>
                                                        <p className="text-[9px] font-bold text-slate-300 mt-1">
                                                            Contact Admin to enable.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                AI Proctoring & Monitoring
                                            </label>
                                            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/30">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                                                        Advanced AI Shield
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                        Eye tracking, noise & person detection.
                                                    </p>
                                                </div>
                                                {canUse('proctoring') && orgPermissions.allowAIProctoring ? (
                                                    <VisibilityToggle
                                                        active={!!exam.aiProctoring}
                                                        onClick={() =>
                                                            setExam((prev) => ({
                                                                ...prev,
                                                                aiProctoring: !prev.aiProctoring,
                                                            }))
                                                        }
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openUpgrade(
                                                                'AI proctoring is available on Starter plans and above.',
                                                            )
                                                        }
                                                        className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-400"
                                                    >
                                                        <Lock size={10} /> Disabled
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Tab Switch Limit
                                            </label>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-24 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-black text-[var(--brand)] outline-none focus:border-[var(--brand-light)] shadow-inner"
                                                    placeholder="3"
                                                    value={exam.tabSwitchLimit ?? ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            setExam((prev) => ({ ...prev, tabSwitchLimit: undefined }));
                                                            return;
                                                        }
                                                        const num = parseInt(val);
                                                        setExam((prev) => ({
                                                            ...prev,
                                                            tabSwitchLimit: Math.max(0, num),
                                                        }));
                                                    }}
                                                />
                                                <p className="text-[10px] font-medium text-slate-400 leading-tight">
                                                    Maximum times a student can switch tabs before being blocked.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeQuestion ? (
                        <QuestionBuilder
                            question={activeQuestion}
                            onChange={(updates) => {
                                setExam((prev) => ({
                                    ...prev,
                                    sections: prev.sections?.map((s) =>
                                        s.id === activeSectionId
                                            ? {
                                                  ...s,
                                                  questions: s.questions.map((q) =>
                                                      q.id === activeQuestionId ? { ...q, ...updates } : q,
                                                  ),
                                              }
                                            : s,
                                    ),
                                }));
                            }}
                        />
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-slate-300">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                                <Settings size={40} />
                            </div>
                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                                Select a question to start editing
                            </p>
                            <p className="max-w-md text-sm leading-6 text-slate-400">
                                Choose a section from the left rail, then open a question or add a new item to continue
                                building the assessment.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type || 'danger'}
                confirmLabel={alertConfig.type === 'info' ? 'Close' : 'Delete'}
                onConfirm={() => {
                    alertConfig.onConfirm();
                    setAlertConfig((prev) => ({ ...prev, isOpen: false }));
                }}
                onCancel={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
            />
            {showComingSoon ? (
                <AiGenerateModal
                    kind="exam"
                    availableTypes={getAvailableImportTypes('exam', canUse)}
                    onClose={() => setShowComingSoon(false)}
                    onImport={(importedSections, stats) => {
                        setExam((prev) => ({
                            ...prev,
                            sections: [...(prev.sections || []), ...importedSections],
                        }));
                        setShowComingSoon(false);
                        success(
                            `Imported ${stats.questionsImported} question${stats.questionsImported === 1 ? '' : 's'} across ${stats.sectionsImported} section${stats.sectionsImported === 1 ? '' : 's'}.${stats.questionsSkipped ? ` ${stats.questionsSkipped} skipped.` : ''}`,
                            'Imported',
                        );
                    }}
                />
            ) : null}
            <UpgradeModal
                isOpen={upgradeConfig.isOpen}
                title={upgradeConfig.title}
                message={upgradeConfig.message}
                onClose={() => setUpgradeConfig((prev) => ({ ...prev, isOpen: false }))}
                onUpgrade={() => {
                    setUpgradeConfig((prev) => ({ ...prev, isOpen: false }));
                    if (!upgradePath) {
                        error(
                            'Billing is managed by your administrator. Please contact admin for upgrades.',
                            'Billing Managed by Admin',
                        );
                        return;
                    }
                    window.location.href = upgradePath;
                }}
            />
        </div>
    );
}

function VisibilityToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-14 h-7 rounded-full relative transition-all duration-300 ${active ? 'bg-emerald-500' : 'bg-slate-200'}`}
        >
            <div
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${active ? 'translate-x-7' : ''}`}
            />
        </button>
    );
}

function OverviewChip({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <span className="ml-2 text-sm font-semibold text-slate-950">{value}</span>
        </div>
    );
}

function SidebarMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
    );
}

// useSortable is a hook, so each section/question needs its own component —
// it can't be called inline inside a .map() callback. The grip icon (not the
// whole row) carries the drag listeners so click-to-select, rename, delete,
// and the expand chevron all keep working exactly as before.
function SectionRow({
    section,
    isActive,
    onSelect,
    onRename,
    onDelete,
    activeQuestionId,
    onSelectQuestion,
    onDeleteQuestion,
    showAddMenu,
    onToggleAddMenu,
    onAddQuestion,
    canUse,
    openUpgrade,
}: {
    section: Section;
    isActive: boolean;
    onSelect: () => void;
    onRename: (title: string) => void;
    onDelete: () => void;
    activeQuestionId: string | null;
    onSelectQuestion: (id: string) => void;
    onDeleteQuestion: (id: string) => void;
    showAddMenu: boolean;
    onToggleAddMenu: () => void;
    onAddQuestion: (type: Question['type']) => void;
    canUse: (feature: string) => boolean;
    openUpgrade: (message: string, title?: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
        data: { type: 'section' },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="space-y-1">
            <div
                onClick={onSelect}
                className={`group flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all border ${isActive ? 'bg-white border-[var(--brand-light)] shadow-md shadow-[var(--brand)]/5 text-slate-900' : 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-100 hover:shadow-sm'}`}
            >
                <span
                    {...attributes}
                    {...listeners}
                    onClick={(e) => e.stopPropagation()}
                    className="touch-none text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical size={14} />
                </span>
                {isActive ? (
                    <input
                        type="text"
                        value={section.title}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onRename(e.target.value)}
                        placeholder="Section name"
                        className="text-xs font-black flex-1 bg-transparent border-b border-transparent focus:border-[var(--brand-light)] outline-none text-slate-900"
                    />
                ) : (
                    <span className="text-xs font-black flex-1 truncate">{section.title}</span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {section.questions.length}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                >
                    <Trash2 size={12} />
                </button>
                <ChevronRight size={14} className={`transition-transform ${isActive ? 'rotate-90' : ''}`} />
            </div>

            {isActive && (
                <div className="pl-8 space-y-1 py-1">
                    <SortableContext items={section.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                        {section.questions.map((q) => (
                            <QuestionRow
                                key={q.id}
                                question={q}
                                sectionId={section.id}
                                isActive={activeQuestionId === q.id}
                                onSelect={() => onSelectQuestion(q.id)}
                                onDelete={() => onDeleteQuestion(q.id)}
                            />
                        ))}
                    </SortableContext>
                    <div className="relative">
                        <button
                            onClick={onToggleAddMenu}
                            className="flex items-center gap-2 px-3 py-2 w-full text-[var(--brand)] opacity-70 hover:opacity-100 transition-opacity text-[10px] font-black uppercase tracking-wider"
                        >
                            <Plus size={12} strokeWidth={3} />
                            Add Exam Question
                        </button>

                        {showAddMenu && (
                            <div className="absolute left-0 top-full z-50 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <AddMenuItem
                                    onClick={() => onAddQuestion('MCQ')}
                                    label="Single Choice (MCQ)"
                                    icon={<HelpCircle size={14} />}
                                />
                                <AddMenuItem
                                    onClick={() => onAddQuestion('MultiSelect')}
                                    label="Multiple Choice"
                                    icon={<CheckCircle2 size={14} className="text-emerald-500" />}
                                />
                                <AddMenuItem
                                    onClick={() => onAddQuestion('Coding')}
                                    label="Coding Exercise"
                                    icon={<Code size={14} className="text-indigo-500" />}
                                    disabled={!canUse('coding')}
                                    onDisabledClick={() =>
                                        openUpgrade('Coding questions are available on Starter plans and above.')
                                    }
                                />
                                <AddMenuItem
                                    onClick={() => onAddQuestion('Web')}
                                    label="Web Assessment"
                                    icon={<Globe size={14} className="text-blue-500" />}
                                    disabled={!canUse('webEditor')}
                                    onDisabledClick={() =>
                                        openUpgrade('Web editor questions are available on Starter plans and above.')
                                    }
                                />
                                <AddMenuItem
                                    onClick={() => onAddQuestion('Notebook')}
                                    label="Notebook"
                                    icon={<TerminalSquare size={14} className="text-orange-500" />}
                                    disabled={!canUse('pythonNotebook')}
                                    onDisabledClick={() =>
                                        openUpgrade('Notebook questions are available on Pro and Enterprise plans.')
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function QuestionRow({
    question,
    sectionId,
    isActive,
    onSelect,
    onDelete,
}: {
    question: Question;
    sectionId: string;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: question.id,
        data: { type: 'question', sectionId },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={`group/q flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-[var(--brand-light)] border-[var(--brand-light)] text-[var(--brand-dark)]' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'}`}
        >
            <span
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="touch-none opacity-40 hover:opacity-100 cursor-grab active:cursor-grabbing"
            >
                <GripVertical size={12} />
            </span>
            <QuestionIcon type={question.type} />
            <span className="text-[11px] font-bold truncate flex-1">{question.title}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="opacity-0 group-hover/q:opacity-100 p-1 hover:text-red-500 transition-all"
            >
                <Trash2 size={10} />
            </button>
        </div>
    );
}

function AddMenuItem({
    onClick,
    label,
    icon,
    disabled,
    onDisabledClick,
}: {
    onClick: () => void;
    label: string;
    icon: any;
    disabled?: boolean;
    onDisabledClick?: () => void;
}) {
    return (
        <button
            onClick={() => {
                if (disabled) {
                    onDisabledClick?.();
                    return;
                }
                onClick();
            }}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}
        >
            <span className="text-slate-400 group-hover:text-[var(--brand)] transition-colors uppercase">{icon}</span>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">
                {label}
            </span>
        </button>
    );
}

function QuestionIcon({ type }: { type: Question['type'] }) {
    switch (type) {
        case 'MCQ':
            return <HelpCircle size={14} />;
        case 'MultiSelect':
            return <CheckCircle2 size={14} className="text-emerald-500" />;
        case 'Coding':
            return <Code size={14} className="text-[var(--brand)]" />;
        case 'Web':
            return <Globe size={14} className="text-blue-500" />;
        case 'Notebook':
            return <TerminalSquare size={14} className="text-orange-500" />;
        default:
            return <HelpCircle size={14} />;
    }
}
