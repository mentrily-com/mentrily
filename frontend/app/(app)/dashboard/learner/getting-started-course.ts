import type { UnitQuestion } from '@/types/unit';

export const MENTRILY_ONBOARDING_COURSE_SLUG = 'getting-started-with-mentrily';
export const MENTRILY_ONBOARDING_STORAGE_KEY = 'mentrily_getting_started_hidden';
export const MENTRILY_ONBOARDING_SKIP_KEY = 'mentrily_onboarding_skipped_permanent';

export const onboardingUnitIds = {
    welcome: 'mentrily-welcome-reading',
    intent: 'mentrily-learning-intent-mcq',
    expectations: 'mentrily-course-expectations-multiselect',
    coding: 'mentrily-first-coding-workspace',
    web: 'mentrily-web-lab-preview',
    notebook: 'mentrily-notebook-reflection',
    examReading: 'mentrily-exam-readiness-brief',
    examMcq: 'mentrily-exam-check-mcq',
    examCoding: 'mentrily-exam-coding-check',
};

export const onboardingCourseModules = [
    {
        id: 'mentrily-onboarding-orientation',
        title: 'How learning works in Mentrily',
        units: [
            { id: onboardingUnitIds.welcome, type: 'Reading', title: 'Welcome to Mentrily' },
            { id: onboardingUnitIds.intent, type: 'MCQ', title: 'Tell us your main learning goal' },
            { id: onboardingUnitIds.expectations, type: 'MultiSelect', title: 'Shape your ideal course experience' },
        ],
    },
    {
        id: 'mentrily-onboarding-practice',
        title: 'Try every interactive workspace',
        units: [
            { id: onboardingUnitIds.coding, type: 'Coding', title: 'Make a tiny learning assistant' },
            { id: onboardingUnitIds.web, type: 'Web', title: 'Edit a live web lesson card' },
            { id: onboardingUnitIds.notebook, type: 'Notebook', title: 'Use a notebook for quick reflection' },
        ],
    },
];

export const onboardingCourseTests = [
    {
        id: 'mentrily-course-exam',
        title: 'Mentrily Readiness Exam',
        items: 3,
        questions: [
            { id: onboardingUnitIds.examReading, type: 'Reading', title: 'Before you take a course exam' },
            { id: onboardingUnitIds.examMcq, type: 'MCQ', title: 'Choose the best next step' },
            { id: onboardingUnitIds.examCoding, type: 'Coding', title: 'Complete a tiny exam task' },
        ],
    },
];

export const gettingStartedCourse = {
    title: 'Getting Started with Mentrily',
    slug: MENTRILY_ONBOARDING_COURSE_SLUG,
    sections: onboardingCourseModules.length,
    totalUnits:
        onboardingCourseModules.reduce((count, module) => count + module.units.length, 0) +
        onboardingCourseTests.reduce((count, test) => count + test.items, 0),
    percent: 0,
    status: 'Onboarding',
    modules: onboardingCourseModules,
    tests: onboardingCourseTests,
    linkedExam: null,
    isOnboardingCourse: true,
};

const commonModule = {
    course: {
        title: gettingStartedCourse.title,
        slug: MENTRILY_ONBOARDING_COURSE_SLUG,
    },
};

export const onboardingQuestions: Record<string, UnitQuestion> = {
    [onboardingUnitIds.welcome]: {
        id: onboardingUnitIds.welcome,
        type: 'Reading',
        title: 'Welcome to Mentrily',
        description:
            '<p>Mentrily courses are built around short lessons, practice questions, feedback, and final checks. This starter course is a guided preview: you will see how lessons open, how interactive workspaces feel, and how exams are presented before you begin a real course.</p>',
        module: { id: 'mentrily-onboarding-orientation', title: 'How learning works in Mentrily', ...commonModule },
        moduleTitle: 'How learning works in Mentrily',
        moduleUnits: onboardingCourseModules[0].units,
        readingContent: [
            {
                id: 'welcome-copy',
                type: 'text',
                content:
                    '<h2>Your learning home</h2><p>The dashboard keeps your active courses, announcements, results, bookmarks, and certificates close together. A course is split into sections. Each section contains learning units like readings, quizzes, code tasks, web tasks, and notebooks.</p><p>Use the left menu inside a unit to move between questions. Use Submit Answer when you want Mentrily to record your progress.</p>',
            },
        ],
    },
    [onboardingUnitIds.intent]: {
        id: onboardingUnitIds.intent,
        type: 'MCQ',
        title: 'Tell us your main learning goal',
        description:
            '<p>Before a course becomes useful, it should understand why you opened it. Pick the answer that best matches what you want Mentrily to help you do first.</p>',
        module: { id: 'mentrily-onboarding-orientation', title: 'How learning works in Mentrily', ...commonModule },
        moduleTitle: 'How learning works in Mentrily',
        moduleUnits: onboardingCourseModules[0].units,
        mcqOptions: [
            { id: 'build-skills', text: 'Build practical skills through guided lessons and hands-on practice.', isCorrect: true },
            { id: 'only-read', text: 'Only read long notes without any practice or feedback.' },
            { id: 'skip-context', text: 'Skip course context and jump into random tasks.' },
            { id: 'avoid-results', text: 'Avoid seeing progress, attempts, or results.' },
        ],
    },
    [onboardingUnitIds.expectations]: {
        id: onboardingUnitIds.expectations,
        type: 'MultiSelect',
        title: 'Shape your ideal course experience',
        description:
            '<p>Mentrily courses can include explanations, runnable code, quizzes, web tasks, notebooks, exams, and certificates. Select the course features you would expect from a strong learning experience.</p>',
        module: { id: 'mentrily-onboarding-orientation', title: 'How learning works in Mentrily', ...commonModule },
        moduleTitle: 'How learning works in Mentrily',
        moduleUnits: onboardingCourseModules[0].units,
        mcqOptions: [
            { id: 'clear-lessons', text: 'Clear lessons that explain what I am learning and why it matters.', isCorrect: true },
            { id: 'practice', text: 'Practice questions that let me try the idea immediately.', isCorrect: true },
            { id: 'feedback', text: 'Feedback, attempts, and progress so I know what to improve.', isCorrect: true },
            { id: 'guesswork', text: 'Hidden expectations where I have to guess what the course wants.' },
        ],
    },
    [onboardingUnitIds.coding]: {
        id: onboardingUnitIds.coding,
        type: 'Coding',
        title: 'Make a tiny learning assistant',
        description:
            '<p>Coding questions give you a real editor, test cases, and a submit flow. Complete the function so it returns a friendly one-line plan for a learner who is starting a new Mentrily course.</p><p><strong>Task:</strong> return the exact string <code>Start small, practice often.</code></p>',
        module: { id: 'mentrily-onboarding-practice', title: 'Try every interactive workspace', ...commonModule },
        moduleTitle: 'Try every interactive workspace',
        moduleUnits: onboardingCourseModules[1].units,
        codingConfig: {
            languageId: 'javascript',
            header: '',
            initialCode: "function learnerPlan() {\n  // Return the starter advice here.\n  return '';\n}",
            footer: '\nconsole.log(learnerPlan());',
            allowedLanguages: ['javascript'],
            testCases: [
                {
                    input: '',
                    expectedOutput: 'Start small, practice often.',
                    hidden: false,
                },
            ],
        },
    },
    [onboardingUnitIds.web]: {
        id: onboardingUnitIds.web,
        type: 'Web',
        title: 'Edit a live web lesson card',
        description:
            '<p>Web questions let you edit HTML, CSS, and JavaScript with a live preview. Make the card feel like a course welcome screen: keep it simple, readable, and learner-focused.</p><p><strong>Task:</strong> update the card text or style, then submit it.</p>',
        module: { id: 'mentrily-onboarding-practice', title: 'Try every interactive workspace', ...commonModule },
        moduleTitle: 'Try every interactive workspace',
        moduleUnits: onboardingCourseModules[1].units,
        webConfig: {
            initialHTML:
                '<main class="course-card"><p class="eyebrow">Mentrily Starter</p><h1>Welcome, learner.</h1><p>Use lessons, practice, and feedback to turn small steps into visible progress.</p><button>Begin practice</button></main>',
            initialCSS:
                'body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: ui-sans-serif, system-ui; background: #f8fafc; color: #0f172a; } .course-card { width: min(520px, calc(100vw - 32px)); border: 1px solid #e2e8f0; border-radius: 18px; padding: 32px; background: white; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); } .eyebrow { font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; color: #f97316; } h1 { margin: 0 0 12px; font-size: 36px; } p { line-height: 1.6; } button { margin-top: 12px; border: 0; border-radius: 12px; padding: 12px 16px; font-weight: 800; background: #0f172a; color: white; }',
            initialJS: '',
            showFiles: { html: true, css: true, js: true },
            testCases: [],
        },
    },
    [onboardingUnitIds.notebook]: {
        id: onboardingUnitIds.notebook,
        type: 'Notebook',
        title: 'Use a notebook for quick reflection',
        description:
            '<p>Notebook questions are useful when a course wants you to explore data, write short experiments, or explain your thinking. Run this small Python reflection and submit it.</p>',
        module: { id: 'mentrily-onboarding-practice', title: 'Try every interactive workspace', ...commonModule },
        moduleTitle: 'Try every interactive workspace',
        moduleUnits: onboardingCourseModules[1].units,
        notebookConfig: {
            language: 'python',
            initialCode:
                "goals = ['understand the dashboard', 'try practice questions', 'finish a course exam']\nfor index, goal in enumerate(goals, start=1):\n    print(f'{index}. {goal}')",
        },
    },
    [onboardingUnitIds.examReading]: {
        id: onboardingUnitIds.examReading,
        type: 'Reading',
        title: 'Before you take a course exam',
        description:
            '<p>A course exam checks whether the core ideas from the course are ready to use. Mentrily exams can include the same rich question types you practiced in lessons, but the experience is more focused and structured.</p>',
        module: { id: 'mentrily-course-exam', title: 'Mentrily Readiness Exam', ...commonModule },
        moduleTitle: 'Mentrily Readiness Exam',
        moduleUnits: onboardingCourseTests[0].questions,
        readingContent: [
            {
                id: 'exam-brief',
                type: 'text',
                content:
                    '<h2>What to expect</h2><p>Read the prompt carefully, answer what is asked, and submit when you are ready. In real exams, your organization may set time windows, attempt limits, monitoring rules, and pass thresholds.</p>',
            },
        ],
    },
    [onboardingUnitIds.examMcq]: {
        id: onboardingUnitIds.examMcq,
        type: 'MCQ',
        title: 'Choose the best next step',
        description:
            '<p>You finish a lesson and want to keep momentum without rushing. What is the best next step in Mentrily?</p>',
        module: { id: 'mentrily-course-exam', title: 'Mentrily Readiness Exam', ...commonModule },
        moduleTitle: 'Mentrily Readiness Exam',
        moduleUnits: onboardingCourseTests[0].questions,
        mcqOptions: [
            { id: 'review-submit', text: 'Review the prompt, submit your answer, then check progress or attempts.', isCorrect: true },
            { id: 'close-tab', text: 'Close the tab before submitting.' },
            { id: 'ignore-feedback', text: 'Ignore results and repeat the same mistake.' },
            { id: 'random-answer', text: 'Pick random answers because the dashboard will fix them.' },
        ],
    },
    [onboardingUnitIds.examCoding]: {
        id: onboardingUnitIds.examCoding,
        type: 'Coding',
        title: 'Complete a tiny exam task',
        description:
            '<p>This final check mirrors a small course exam coding question. Complete the function so it returns the word learners should remember when using Mentrily.</p><p><strong>Task:</strong> return <code>practice</code>.</p>',
        module: { id: 'mentrily-course-exam', title: 'Mentrily Readiness Exam', ...commonModule },
        moduleTitle: 'Mentrily Readiness Exam',
        moduleUnits: onboardingCourseTests[0].questions,
        codingConfig: {
            languageId: 'javascript',
            header: '',
            initialCode: "function mentrilyKeyword() {\n  return '';\n}",
            footer: '\nconsole.log(mentrilyKeyword());',
            allowedLanguages: ['javascript'],
            testCases: [{ input: '', expectedOutput: 'practice', hidden: false }],
        },
    },
};

export function isOnboardingCourseHidden() {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(MENTRILY_ONBOARDING_STORAGE_KEY) === 'true';
}

export function getOnboardingQuestion(id: string) {
    return onboardingQuestions[id] || null;
}
