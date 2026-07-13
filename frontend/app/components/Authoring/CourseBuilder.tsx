'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Layout,
    Settings,
    Eye,
    EyeOff,
    Save,
    GripVertical,
    ChevronRight,
    FileText,
    Code,
    Globe,
    HelpCircle,
    CheckCircle2,
    BarChart3,
    Sparkles,
    Trash2,
    TerminalSquare,
    PanelLeftClose,
    PanelLeftOpen,
    Calendar,
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
import { Course, Section, Question } from './types';
import { TeacherService } from '@/services/api/TeacherService';
import QuestionBuilder from './QuestionBuilder/QuestionBuilder';
import StudentPreview from './StudentPreview';
import AlertModal from '../Common/AlertModal';
import { useToast } from '../Common/Toast';
import DashboardSkeleton from '../Skeletons/DashboardSkeleton';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from '../Common/UpgradeModal';
import CourseExamSection from '../Features/Courses/CourseExamSection';
import OnboardingTour from '../Common/OnboardingTour';
import AiGenerateModal from './AiGenerateModal';
import { getAvailableImportTypes } from './aiImport';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
    ssr: false,
    loading: () => <DashboardSkeleton type="form" noNavbar />,
});

const createDefaultCourse = (): Course => ({
    title: '',
    shortDescription: '',
    longDescription: '',
    difficulty: 'Beginner',
    tags: [],
    isVisible: false,
    sections: [
        {
            id: 'sec-1',
            title: 'Introduction',
            questions: [],
        },
    ],
    tests: [],
});

const normalizeQuestion = (question: Question): Question => {
    if (question.type !== 'Reading') return question;

    const contentBlocks = Array.isArray(question.readingConfig?.contentBlocks)
        ? question.readingConfig.contentBlocks
        : [{ id: '1', type: 'text' as const, content: '<p>Start writing your content...</p>' }];

    return {
        ...question,
        readingConfig: {
            ...question.readingConfig,
            contentBlocks: contentBlocks.map((block, index) => ({
                id: block.id || `reading-block-${index + 1}`,
                type: block.type || 'text',
                content: block.content || '',
                videoUrl: block.videoUrl,
                runnerConfig: block.runnerConfig,
            })),
        },
    };
};

const normalizeSections = (sections?: Course['sections']): Course['sections'] => {
    if (!Array.isArray(sections) || sections.length === 0) {
        return createDefaultCourse().sections;
    }

    return sections.map((section, index) => ({
        ...section,
        id: section.id || `sec-${index + 1}`,
        title: section.title || `Section ${index + 1}`,
        questions: Array.isArray(section.questions) ? section.questions.map(normalizeQuestion) : [],
    }));
};

const normalizeCourse = (raw?: Course): Course => {
    const base = raw || createDefaultCourse();
    const certificateTemplateId =
        base.certificateTemplateId || ((base as any).certificateTemplate?.id as string | undefined);
    const linkedExamId = base.linkedExamId || base.linkedExam?.id;
    return {
        ...base,
        linkedExamId,
        certificateTemplateId,
        sections: normalizeSections(base.sections),
        tests: Array.isArray(base.tests)
            ? base.tests.map((section, index) => ({
                ...section,
                id: section.id || `test-${index + 1}`,
                title: section.title || `Test ${index + 1}`,
                questions: Array.isArray(section.questions) ? section.questions.map(normalizeQuestion) : [],
            }))
            : [],
    };
};

export default function CourseBuilder({
    initialData,
    onDelete,
    onSave,
    basePath,
    userRole,
    orgPermissions = { allowCourseTests: true },
    organizationId,
}: {
    initialData?: Course;
    onDelete?: () => void;
    onSave?: (data: any) => Promise<void>;
    basePath?: string;
    userRole?: 'admin' | 'teacher' | 'super-admin';
    orgPermissions?: { allowCourseTests?: boolean; teacherSelfBilling?: boolean };
    organizationId?: string;
}) {
    const router = useRouter();
    const { success, error } = useToast();
    const [course, setCourse] = useState<Course>(normalizeCourse(initialData));
    const [savedBaseline, setSavedBaseline] = useState<Course>(normalizeCourse(initialData));

    const [activeTab, setActiveTab] = useState<'unit' | 'test'>('unit');
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
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [certificateTemplates, setCertificateTemplates] = useState<Array<{ id: string; name: string }>>([]);
    const [upgradeConfig, setUpgradeConfig] = useState<{ isOpen: boolean; title: string; message: string }>({
        isOpen: false,
        title: 'Upgrade Required',
        message: '',
    });
    const { canUse } = usePlan();
    const initialCourseId = initialData?.id;
    const isEditMode = Boolean(initialCourseId && !String(initialCourseId).startsWith('course-'));

    const getInitialDraftKey = () =>
        initialCourseId ? `course_builder_draft_${initialCourseId}` : 'course_builder_draft_new';
    const getCurrentDraftKey = () => (course.id ? `course_builder_draft_${course.id}` : 'course_builder_draft_new');

    useEffect(() => {
        if (initialData) {
            setSavedBaseline(normalizeCourse(initialData as Course));
        }
    }, [initialData]);

    useEffect(() => {
        setCertificateTemplates([]);
    }, []);

    // Persistence: Load from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const key = getInitialDraftKey();
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const draft = parsed || {};
                    const {
                        status: _draftStatus,
                        isVisible: _draftVisibility,
                        id: _draftId,
                        slug: _draftSlug,
                        creatorId: _draftCreatorId,
                        orgId: _draftOrgId,
                        ...restDraft
                    } = draft;

                    const restored = isEditMode ? { ...draft, ...restDraft } : restDraft;
                    setCourse((prev) => ({ ...prev, ...restored }));
                    success('Restored draft from local storage', 'Draft Restored');
                } catch (e) {
                    console.error('Failed to load draft', e);
                }
            }
        }
    }, []);

    // Persistence: Save to localStorage on change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const key = getCurrentDraftKey();
            const timeout = setTimeout(() => {
                localStorage.setItem(key, JSON.stringify(course));
            }, 1000); // Debounce 1s
            return () => clearTimeout(timeout);
        }
    }, [course]);

    // Date formatting helpers for datetime-local inputs
    const formatISOToInput = (iso?: string) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            const pad = (n: number) => n.toString().padStart(2, '0');
            const yyyy = d.getFullYear();
            const MM = pad(d.getMonth() + 1);
            const dd = pad(d.getDate());
            const hh = pad(d.getHours());
            const mm = pad(d.getMinutes());
            return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
        } catch (e) {
            return '';
        }
    };

    const convertInputToISO = (localString?: string) => {
        if (!localString) return '';
        // localString is expected like "yyyy-MM-ddTHH:mm" (no timezone)
        const dt = new Date(localString);
        if (isNaN(dt.getTime())) return '';
        return dt.toISOString();
    };

    const activeList = activeTab === 'unit' ? course.sections : course.tests || [];
    const activeSection = activeList.find((s) => s.id === activeSectionId);
    const activeQuestion = activeSection?.questions?.find((q) => q.id === activeQuestionId);

    const addSection = () => {
        const newSection: any = {
            id: `${activeTab === 'unit' ? 'sec' : 'test'}-${Date.now()}`,
            title: activeTab === 'unit' ? 'New Section' : 'New Test',
            questions: [],
        };

        if (activeTab === 'test') {
            newSection.startDate = '';
            newSection.endDate = '';
        }

        setCourse((prev) => ({
            ...prev,
            [activeTab === 'unit' ? 'sections' : 'tests']: [
                ...(activeTab === 'unit' ? prev.sections : prev.tests || []),
                newSection,
            ],
        }));
        setActiveSectionId(newSection.id);
    };

    const renameSection = (sectionId: string, title: string) => {
        setCourse((prev) => {
            if (activeTab === 'unit') {
                return {
                    ...prev,
                    sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
                };
            }

            return {
                ...prev,
                tests: (prev.tests || []).map((s) => (s.id === sectionId ? { ...s, title } : s)),
            };
        });
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
                        showTestCases: true,
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
            readingConfig:
                type === 'Reading'
                    ? {
                        contentBlocks: [{ id: '1', type: 'text', content: '<p>Start writing your content...</p>' }],
                    }
                    : undefined,
            notebookConfig:
                type === 'Notebook'
                    ? {
                        initialCode:
                            '# Write your Python code here\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nprint("Hello from Python Notebook!")',
                        language: 'python',
                        maxExecutionTime: 10,
                        allowedLibraries: ['numpy', 'matplotlib'],
                    }
                    : undefined,
        };

        setCourse((prev) => {
            if (activeTab === 'unit') {
                return {
                    ...prev,
                    sections: prev.sections.map((s) =>
                        s.id === activeSectionId ? { ...s, questions: [...(s.questions || []), newQuestion] } : s,
                    ),
                };
            } else {
                return {
                    ...prev,
                    tests: (prev.tests || []).map((s) =>
                        s.id === activeSectionId ? { ...s, questions: [...(s.questions || []), newQuestion] } : s,
                    ),
                };
            }
        });
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
            title: `Delete ${activeTab === 'unit' ? 'Section' : 'Test'}?`,
            message: 'Are you sure you want to delete this? All questions in it will be lost.',
            onConfirm: () => {
                const listName = activeTab === 'unit' ? 'sections' : 'tests';
                setCourse((prev) => ({
                    ...prev,
                    [listName]: (prev[listName] as any[]).filter((s) => s.id !== sectionId),
                }));
                if (activeSectionId === sectionId) {
                    const currentList = activeTab === 'unit' ? course.sections : course.tests || [];
                    setActiveSectionId(currentList.find((s) => s.id !== sectionId)?.id || '');
                }
                setAlertConfig((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    const deleteQuestion = (sectionId: string, questionId: string) => {
        setAlertConfig({
            isOpen: true,
            title: 'Delete Question?',
            message: 'This action cannot be undone.',
            onConfirm: () => {
                const updateList = (list: any[]) =>
                    list.map((s) =>
                        s.id === sectionId
                            ? { ...s, questions: (s.questions || []).filter((q: any) => q.id !== questionId) }
                            : s,
                    );

                setCourse((prev) => {
                    if (activeTab === 'unit') {
                        return { ...prev, sections: updateList(prev.sections) };
                    } else {
                        return { ...prev, tests: updateList(prev.tests || []) };
                    }
                });
                if (activeQuestionId === questionId) setActiveQuestionId(null);
                setAlertConfig((prev) => ({ ...prev, isOpen: false }));
            },
        });
    };

    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Single DndContext covers both the section/test list and, nested inside
    // each expanded section, its question list. activeTab decides whether a
    // section-level reorder targets `sections` or `tests`.
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const activeData = active.data.current as { type?: string; sectionId?: string } | undefined;
        const listKey = activeTab === 'unit' ? 'sections' : 'tests';

        if (activeData?.type === 'section') {
            setCourse((prev) => {
                const list: any[] = (prev as any)[listKey] || [];
                const oldIndex = list.findIndex((s) => s.id === active.id);
                const newIndex = list.findIndex((s) => s.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return prev;
                return { ...prev, [listKey]: arrayMove(list, oldIndex, newIndex) };
            });
            return;
        }

        if (activeData?.type === 'question' && activeData.sectionId) {
            const sectionId = activeData.sectionId;
            setCourse((prev) => {
                const list: any[] = (prev as any)[listKey] || [];
                return {
                    ...prev,
                    [listKey]: list.map((s) => {
                        if (s.id !== sectionId) return s;
                        const questions = s.questions || [];
                        const oldIndex = questions.findIndex((q: any) => q.id === active.id);
                        const newIndex = questions.findIndex((q: any) => q.id === over.id);
                        if (oldIndex === -1 || newIndex === -1) return s;
                        return { ...s, questions: arrayMove(questions, oldIndex, newIndex) };
                    }),
                };
            });
        }
    };

    const resetDraft = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(getInitialDraftKey());
            localStorage.removeItem(getCurrentDraftKey());
            localStorage.removeItem('course_builder_draft_new');
        }

        const nextCourse = normalizeCourse(savedBaseline || initialData || createDefaultCourse());
        setCourse(nextCourse);
        setActiveTab('unit');
        setActiveStep('builder');
        setActiveSectionId(nextCourse.sections?.[0]?.id || 'sec-1');
        setActiveQuestionId(null);
        setShowAddMenu(null);
        setPreviewMode(null);
        success('Draft reset successfully', 'Draft Reset');
    };

    const totalUnits = course.sections.length;
    const totalTests = (course.tests || []).length;
    const totalQuestions =
        course.sections.reduce((sum, section) => sum + (section.questions || []).length, 0) +
        (course.tests || []).reduce((sum, section) => sum + (section.questions || []).length, 0);
    const linkedAssetsCount =
        Number(Boolean(course.linkedExamId || course.linkedExam?.id)) + Number(Boolean(course.certificateTemplateId));
    const workspaceLabel =
        activeStep === 'metadata'
            ? 'Course settings'
            : activeQuestion
                ? 'Question editor'
                : activeTab === 'unit'
                    ? 'Curriculum builder'
                    : 'Assessment builder';
    const courseStatus = course.status === 'Published' ? 'Published' : 'Draft';
    const activeQuestionCount = activeSection?.questions?.length || 0;
    const builderStats = [
        { label: 'Units', value: totalUnits },
        { label: 'Tests', value: totalTests },
        { label: 'Questions', value: totalQuestions },
        { label: 'Linked assets', value: linkedAssetsCount },
    ];

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            {/* ignoreUserOnboardingFlag: keep this tour's completion
                independent of the shared backend flag other creator/admin
                tours used to write to — see dashboard/creator/page.tsx
                for the full explanation. */}
            {!initialData?.id ? (
                <OnboardingTour
                    tourId="creator_course_builder"
                    ignoreUserOnboardingFlag
                    steps={[
                        {
                            element: '[data-element-id="course-builder-title"]',
                            title: 'Name the course first',
                            description: 'Set the course title before you build so modules, tests, and linked outcomes stay organized.',
                        },
                        {
                            element: '[data-element-id="course-builder-units"]',
                            title: 'Build the learning flow here',
                            description: 'Add sections and questions to shape the course path your learners will move through.',
                        },
                        {
                            element: '[data-element-id="course-builder-linked-exam"]',
                            title: 'Finish with a linked exam',
                            description: 'After saving the course, link an exam to control unlock %, pass %, retries, and buffers.',
                        },
                    ]}
                />
            ) : null}
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
                        <span className="hidden lg:inline-flex shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                            Course Builder
                        </span>
                        <input
                            data-element-id="course-builder-title"
                            type="text"
                            aria-label="Course title"
                            placeholder="Course Title..."
                            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-[var(--brand-light)] focus:bg-slate-50 md:text-base"
                            value={course.title}
                            onChange={(e) => setCourse((prev) => ({ ...prev, title: e.target.value }))}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newStatus = course.status === 'Published' ? 'Draft' : 'Published';
                                setCourse((prev) => ({
                                    ...prev,
                                    status: newStatus,
                                    isVisible: newStatus === 'Published',
                                }));
                            }}
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] cursor-pointer transition-colors ${course.status === 'Published' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${course.status === 'Published' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            />
                            <span className="hidden sm:inline">{course.status || 'Draft'}</span>
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
                                        title: 'Delete Course?',
                                        message:
                                            'This will permanently remove the course and all its contents. This action cannot be undone.',
                                        onConfirm: onDelete,
                                    })
                                }
                                className="cursor-pointer rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                title="Delete course"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => setPreviewMode(previewMode ? null : 'desktop')}
                            disabled={!activeQuestion}
                            className={`cursor-pointer rounded-xl p-2.5 transition-colors disabled:opacity-30 ${previewMode ? 'bg-[var(--brand)] text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-[var(--brand)]'}`}
                            title={activeQuestion ? (previewMode ? 'Close preview' : 'Preview question') : 'Select a question first'}
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
                                    const sanitized = JSON.parse(JSON.stringify(course));
                                    sanitized.linkedExamId = sanitized.linkedExamId || sanitized.linkedExam?.id || null;
                                    sanitized.certificateTemplateId = sanitized.certificateTemplateId || null;
                                    sanitized.examUnlockThreshold = Number(sanitized.examUnlockThreshold ?? 100);
                                    sanitized.examPassThreshold = Number(sanitized.examPassThreshold ?? 60);
                                    sanitized.completionThreshold = Number(sanitized.completionThreshold ?? 100);

                                    if (!sanitized.linkedExamId) {
                                        sanitized.examUnlockThreshold = null;
                                        sanitized.examPassThreshold = null;
                                    }

                                    if (!sanitized.certificateTemplateId) {
                                        sanitized.completionThreshold = null;
                                    }

                                    (sanitized.tests || []).forEach((t: any) => {
                                        if (t.startDate && !t.startDate.endsWith('Z'))
                                            t.startDate = convertInputToISO(t.startDate);
                                        if (t.endDate && !t.endDate.endsWith('Z'))
                                            t.endDate = convertInputToISO(t.endDate);
                                    });

                                    const isNewCourse = !isEditMode;
                                    const rawStatus =
                                        typeof sanitized.status === 'string' ? sanitized.status.trim() : '';
                                    let normalizedStatus =
                                        rawStatus === 'Published' || rawStatus === 'Draft' || rawStatus === 'Archived'
                                            ? rawStatus
                                            : typeof sanitized.isVisible === 'boolean'
                                                ? sanitized.isVisible
                                                    ? 'Published'
                                                    : 'Draft'
                                                : isNewCourse
                                                    ? 'Published'
                                                    : 'Draft';

                                    if (isNewCourse && normalizedStatus !== 'Published') {
                                        normalizedStatus = 'Published';
                                    }

                                    sanitized.status = normalizedStatus;
                                    if (normalizedStatus === 'Published') sanitized.isVisible = true;
                                    if (normalizedStatus === 'Draft') sanitized.isVisible = false;

                                    setCourse((prev) => ({
                                        ...prev,
                                        status: sanitized.status,
                                        isVisible: sanitized.isVisible,
                                    }));

                                    if (onSave) {
                                        await onSave(sanitized);
                                        setSavedBaseline(sanitized as Course);
                                    } else if (isEditMode && course.id && !course.id.startsWith('course-')) {
                                        const updated = await TeacherService.updateCourse(course.id, sanitized);
                                        setSavedBaseline(updated as Course);
                                        setCourse((prev) => ({
                                            ...prev,
                                            status: updated?.status ?? prev.status,
                                            isVisible:
                                                typeof updated?.isVisible === 'boolean'
                                                    ? updated.isVisible
                                                    : prev.isVisible,
                                        }));
                                        localStorage.removeItem(getCurrentDraftKey());
                                        success('Course updated successfully!', 'Saved');
                                    } else {
                                        delete (sanitized as any).id;
                                        const res = await TeacherService.createCourse(sanitized, organizationId);
                                        setCourse((prev) => ({
                                            ...prev,
                                            id: res.id,
                                            status: sanitized.status,
                                            isVisible: sanitized.isVisible,
                                        }));
                                        setSavedBaseline({
                                            ...(sanitized as Course),
                                            id: res.id,
                                            status: sanitized.status,
                                            isVisible: sanitized.isVisible,
                                        });
                                        localStorage.removeItem('course_builder_draft_new');
                                        localStorage.removeItem(getCurrentDraftKey());
                                        success('Course created successfully!', 'Saved');
                                        // Optional: window.history.pushState({}, '', `${basePath}/${res.id}/edit`);
                                    }
                                } catch (e) {
                                    console.error(e);
                                    const errorPayload = e as any;
                                    const code = errorPayload?.code || errorPayload?.payload?.code;
                                    const resource = errorPayload?.resource || errorPayload?.payload?.resource;
                                    const limit = errorPayload?.limit || errorPayload?.payload?.limit;

                                    if (code === 'QUOTA_EXCEEDED' && resource === 'courses') {
                                        if (userRole === 'teacher' && !teacherSelfBillingEnabled) {
                                            error(
                                                'Course limit reached. Please contact your admin to upgrade your organization plan.',
                                                'Upgrade Needed',
                                            );
                                            return;
                                        }

                                        openUpgrade(
                                            typeof limit === 'number'
                                                ? `Your organization has reached the course limit (${limit}). Upgrade to create more courses.`
                                                : 'Your organization has reached the course limit. Upgrade to create more courses.',
                                        );
                                        return;
                                    }

                                    if (code === 'PLAN_FEATURE_REQUIRED') {
                                        if (userRole === 'teacher' && !teacherSelfBillingEnabled) {
                                            error(
                                                'This feature requires a higher plan. Please contact your admin to upgrade.',
                                                'Upgrade Needed',
                                            );
                                            return;
                                        }

                                        openUpgrade(errorPayload?.message || 'This feature requires a higher plan.');
                                        return;
                                    }

                                    error(
                                        errorPayload?.message || 'Failed to save course. Please try again.',
                                        'Save Failed',
                                    );
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
                                <Save size={16} />
                            )}
                            <span className="hidden sm:inline">{course.id && !course.id.startsWith('course-') ? 'Update Course' : 'Publish Course'}</span>
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
                            <span><span className="text-slate-900 font-bold">{totalUnits}</span> units</span>
                            <span className="h-3 w-px bg-slate-200" />
                            <span><span className="text-slate-900 font-bold">{totalQuestions}</span> qs</span>
                            <span className="h-3 w-px bg-slate-200" />
                            <span><span className="text-slate-900 font-bold">{totalTests}</span> tests</span>
                            <span className="h-3 w-px bg-slate-200" />
                            <span><span className="text-[var(--brand)] font-bold">{activeQuestionCount}</span> active</span>
                        </div>
                    </div>

                    {/* Unit / Test Tab Switcher */}
                    <div className="border-b border-slate-200 bg-white px-4 py-2.5">
                        <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
                            <button
                                onClick={() => {
                                    setActiveTab('unit');
                                    setActiveStep('builder');
                                }}
                                className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'unit' && activeStep === 'builder' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Layout size={11} /> Units
                            </button>
                            {orgPermissions.allowCourseTests && (
                                <button
                                    onClick={() => {
                                        setActiveTab('test');
                                        setActiveStep('builder');
                                    }}
                                    className={`cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'test' && activeStep === 'builder' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <FileText size={11} /> Tests
                                </button>
                            )}
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
                                    {activeTab === 'unit' ? 'Learning Modules' : 'Exam Modules'}
                                    <button
                                        onClick={addSection}
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
                                        items={(activeTab === 'unit' ? course.sections : course.tests || []).map(
                                            (s) => s.id,
                                        )}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-4" data-element-id="course-builder-units">
                                            {(activeTab === 'unit' ? course.sections : course.tests || []).map(
                                                (section) => (
                                                    <CourseSectionRow
                                                        key={section.id}
                                                        section={section}
                                                        namePlaceholder={
                                                            activeTab === 'unit' ? 'Section name' : 'Test name'
                                                        }
                                                        isActive={activeSectionId === section.id}
                                                        onSelect={() => setActiveSectionId(section.id)}
                                                        onRename={(title) => renameSection(section.id, title)}
                                                        onDelete={() => deleteSection(section.id)}
                                                        activeQuestionId={activeQuestionId}
                                                        onSelectQuestion={(id) => setActiveQuestionId(id)}
                                                        onDeleteQuestion={(id) => deleteQuestion(section.id, id)}
                                                        showAddMenu={showAddMenu === section.id}
                                                        onToggleAddMenu={() =>
                                                            setShowAddMenu(
                                                                showAddMenu === section.id ? null : section.id,
                                                            )
                                                        }
                                                        onAddQuestion={addQuestion}
                                                        canUse={canUse}
                                                        openUpgrade={openUpgrade}
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </SortableContext>
                                </DndContext>

                                {activeTab === 'unit' && (
                                    <div className="mt-6 space-y-4">
                                        <CourseExamSection
                                            linkedExam={
                                                course.linkedExam ||
                                                (course.linkedExamId
                                                    ? {
                                                          id: course.linkedExamId,
                                                          title: 'Linked exam',
                                                          slug: 'linked-exam',
                                                      }
                                                    : null)
                                            }
                                            examUnlockThreshold={course.examUnlockThreshold}
                                            examPassThreshold={course.examPassThreshold}
                                            maxAttempts={course.maxAttempts}
                                            attemptBufferMins={course.attemptBufferMins}
                                            onChangeThreshold={(field, value) =>
                                                setCourse((prev) => ({
                                                    ...prev,
                                                    [field]: value,
                                                }))
                                            }
                                            onBuildExam={() => {
                                                const courseId = course.id;
                                                if (!courseId || String(courseId).startsWith('course-')) {
                                                    error(
                                                        'Save the course once before creating and linking an exam.',
                                                        'Course Not Saved',
                                                    );
                                                    return;
                                                }

                                                if (course.linkedExam?.id) {
                                                    router.push(
                                                        `/dashboard/creator/exams/${course.linkedExam.id}/edit?courseId=${courseId}`,
                                                    );
                                                    return;
                                                }

                                                router.push(`/dashboard/creator/exams/new?courseId=${courseId}`);
                                            }}
                                            onUnlink={async () => {
                                                try {
                                                    const courseId = course.id;
                                                    if (courseId && !String(courseId).startsWith('course-')) {
                                                        await TeacherService.unlinkExamFromCourse(courseId);
                                                    }
                                                    setCourse((prev) => ({
                                                        ...prev,
                                                        linkedExam: null,
                                                        linkedExamId: undefined,
                                                        examUnlockThreshold: undefined,
                                                        examPassThreshold: undefined,
                                                    }));
                                                    success('Exam unlinked from course', 'Updated');
                                                } catch (unlinkError: any) {
                                                    error(
                                                        unlinkError?.message || 'Failed to unlink exam from course',
                                                        'Unlink Failed',
                                                    );
                                                }
                                            }}
                                        />

                                        {/*
                                        <div
                                            data-element-id="course-builder-linked-exam"
                                            className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3"
                                        >
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Certificate Assignment
                                            </p>
                                            <ComingSoon
                                                variant="inline"
                                                title="Certificate Templates"
                                                description="Certificate template assignment will unlock here once the template design workflow is ready."
                                            />
                                            <select
                                                disabled
                                                value={course.certificateTemplateId || ''}
                                                onChange={(event) =>
                                                    setCourse((prev) => ({
                                                        ...prev,
                                                        certificateTemplateId: event.target.value || undefined,
                                                    }))
                                                }
                                                className="w-full cursor-not-allowed px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-400"
                                            >
                                                <option value="">No certificate template</option>
                                                {certificateTemplates.map((template) => (
                                                    <option key={template.id} value={template.id}>
                                                        {template.name}
                                                    </option>
                                                ))}
                                            </select>

                                            <label className="block">
                                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                                    Completion Required
                                                </span>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={course.completionThreshold ?? 100}
                                                        onChange={(event) =>
                                                            setCourse((prev) => ({
                                                                ...prev,
                                                                completionThreshold: Math.max(
                                                                    0,
                                                                    Math.min(100, Number(event.target.value || 0)),
                                                                ),
                                                            }))
                                                        }
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-black text-slate-700"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                        %
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                        */}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">
                                    Course Settings
                                </h3>
                                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                                    <div className="w-12 h-12 bg-[var(--brand-light)] text-[var(--brand)] rounded-xl flex items-center justify-center">
                                        <BarChart3 size={20} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-800 uppercase leading-tight">
                                        Manage the high-level details of this curriculum.
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
                        <div className="flex-1 overflow-y-auto p-5 md:p-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="mx-auto max-w-5xl space-y-6">
                                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                        Course story
                                    </p>
                                    <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-800">
                                        Main curriculum metadata
                                    </h2>
                                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                                        Define how the course appears to learners, how difficult it feels, and what
                                        support content helps them trust the experience before they begin.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Content Status
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <VisibilityToggle
                                                active={course.status === 'Published'}
                                                onClick={() => {
                                                    const newStatus =
                                                        course.status === 'Published' ? 'Draft' : 'Published';
                                                    setCourse((prev) => ({
                                                        ...prev,
                                                        status: newStatus,
                                                        isVisible: newStatus === 'Published',
                                                    }));
                                                }}
                                            />
                                            <span
                                                className={`text-xs font-black uppercase tracking-widest ${course.status === 'Published' ? 'text-emerald-500' : 'text-slate-400'}`}
                                            >
                                                {course.status || 'Draft'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Difficulty Level
                                        </label>
                                        <div className="flex gap-2">
                                            {['Beginner', 'Intermediate', 'Advanced'].map((level: any) => (
                                                <button
                                                    key={level}
                                                    onClick={() =>
                                                        setCourse((prev) => ({ ...prev, difficulty: level }))
                                                    }
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${course.difficulty === level ? 'bg-[var(--brand)] border-[var(--brand)] text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                                >
                                                    {level}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                        Short Catchy Tagline
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold text-slate-700 outline-none focus:border-[var(--brand-light)] transition-all shadow-inner"
                                        placeholder="e.g. Master React Hooks in 2 weeks..."
                                        value={course.shortDescription || ''}
                                        onChange={(e) =>
                                            setCourse((prev) => ({ ...prev, shortDescription: e.target.value }))
                                        }
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Long Description (Detailed Curriculum)
                                        </label>
                                        <button className="flex items-center gap-2 text-[var(--brand)] text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform group">
                                            <Sparkles size={14} className="group-hover:animate-pulse" />
                                            AI Content Writer
                                        </button>
                                    </div>
                                    <RichTextEditor
                                        content={course.longDescription || ''}
                                        onChange={(content) =>
                                            setCourse((prev) => ({ ...prev, longDescription: content }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ) : activeStep === 'builder' && activeTab === 'test' && activeSection && !activeQuestion ? (
                        <div className="flex-1 overflow-y-auto p-5 md:p-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="mx-auto max-w-5xl space-y-6">
                                <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
                                    <h2 className="mb-2 text-2xl font-black tracking-tight text-slate-800">
                                        Test Schedule
                                    </h2>
                                    <p className="text-sm font-medium text-slate-400">
                                        Configure when this test is available to students.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                            <Calendar size={14} /> Start Date & Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[var(--brand)] transition-all"
                                            value={formatISOToInput((activeSection as any).startDate) || ''}
                                            onChange={(e) => {
                                                const val = e.target.value; // 'YYYY-MM-DDTHH:mm'
                                                setCourse((prev) => ({
                                                    ...prev,
                                                    tests: (prev.tests || []).map((t) =>
                                                        t.id === activeSectionId ? { ...t, startDate: val } : t,
                                                    ),
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                            <Calendar size={14} /> End Date & Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[var(--brand)] transition-all"
                                            value={formatISOToInput((activeSection as any).endDate) || ''}
                                            onChange={(e) => {
                                                const val = e.target.value; // 'YYYY-MM-DDTHH:mm'
                                                setCourse((prev) => ({
                                                    ...prev,
                                                    tests: (prev.tests || []).map((t) =>
                                                        t.id === activeSectionId ? { ...t, endDate: val } : t,
                                                    ),
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl shadow-sm">
                                    <div className="flex gap-3">
                                        <div className="shrink-0 pt-0.5">
                                            <Calendar className="text-amber-500" size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-amber-800 uppercase tracking-wide mb-1">
                                                Testing Window Logic
                                            </h4>
                                            <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                                Before the start time, the test card will be visible but locked. After
                                                the end time, it will freeze. Students can only attempt the test between
                                                these two dates.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeQuestion ? (
                        <QuestionBuilder
                            question={activeQuestion}
                            onChange={(updates) => {
                                setCourse((prev) => {
                                    const updateList = (list: any[]) =>
                                        list.map((s) =>
                                            s.id === activeSectionId
                                                ? {
                                                    ...s,
                                                    questions: (s.questions || []).map((q: any) =>
                                                        q.id === activeQuestionId ? { ...q, ...updates } : q,
                                                    ),
                                                }
                                                : s,
                                        );

                                    if (activeTab === 'unit') {
                                        return { ...prev, sections: updateList(prev.sections) };
                                    } else {
                                        return { ...prev, tests: updateList(prev.tests || []) };
                                    }
                                });
                            }}
                        />
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-slate-300">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                                <Settings size={40} />
                            </div>
                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                                Select a question to start authoring
                            </p>
                            <p className="max-w-md text-sm leading-6 text-slate-400">
                                Use the left map to open a unit or test, then choose an existing question or add a new
                                one to continue building.
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
                    kind="course"
                    availableTypes={getAvailableImportTypes('course', canUse)}
                    onClose={() => setShowComingSoon(false)}
                    onImport={(importedSections, stats) => {
                        setCourse((prev) => {
                            const listKey = activeTab === 'unit' ? 'sections' : 'tests';
                            const currentList = (activeTab === 'unit' ? prev.sections : prev.tests) || [];
                            return {
                                ...prev,
                                [listKey]: [...currentList, ...importedSections],
                            } as Course;
                        });
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
function CourseSectionRow({
    section,
    namePlaceholder,
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
    namePlaceholder: string;
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

    const questions = section.questions || [];

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
                        placeholder={namePlaceholder}
                        className="text-xs font-black flex-1 bg-transparent border-b border-transparent focus:border-[var(--brand-light)] outline-none text-slate-900"
                    />
                ) : (
                    <span className="text-xs font-black flex-1 truncate">{section.title}</span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {questions.length}
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
                    <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                        {questions.map((q) => (
                            <CourseQuestionRow
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
                            Add Question
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
                                    label="Coding (DSA)"
                                    icon={<Code size={14} className="text-indigo-500" />}
                                    disabled={!canUse('coding')}
                                    onDisabledClick={() =>
                                        openUpgrade('Coding questions are available on Starter plans and above.')
                                    }
                                />
                                <AddMenuItem
                                    onClick={() => onAddQuestion('Web')}
                                    label="Web Project"
                                    icon={<Globe size={14} className="text-blue-500" />}
                                    disabled={!canUse('webEditor')}
                                    onDisabledClick={() =>
                                        openUpgrade('Web editor questions are available on Starter plans and above.')
                                    }
                                />
                                <AddMenuItem
                                    onClick={() => onAddQuestion('Reading')}
                                    label="Reading / Content"
                                    icon={<FileText size={14} className="text-amber-500" />}
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

function CourseQuestionRow({
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
        case 'Reading':
            return <FileText size={14} className="text-amber-500" />;
        case 'Notebook':
            return <TerminalSquare size={14} className="text-orange-500" />;
        default:
            return <HelpCircle size={14} />;
    }
}
