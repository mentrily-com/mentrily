import {
    BookOpenCheck,
    ClipboardCheck,
    FilePen,
    FileQuestion,
    GraduationCap,
    Lightbulb,
    ListChecks,
    PenLine,
    ScrollText,
    type LucideIcon,
} from 'lucide-react';

export type ChatIntent = 'ask' | 'edit' | 'explain' | 'improve' | 'rubric' | 'summarize' | 'lesson';

export type StudioCommand =
    | { id: 'course' | 'exam'; kind: 'job'; job: 'blueprint'; brief: 'course' | 'exam' }
    | { id: 'quiz'; kind: 'job'; job: 'quiz'; brief: 'exam' }
    | { id: Exclude<ChatIntent, 'ask'>; kind: 'chat'; intent: Exclude<ChatIntent, 'ask'> };

export interface CommandInfo {
    command: StudioCommand;
    label: string;
    description: string;
    placeholder: string;
    icon: LucideIcon;
    /** Needs the full-generation plan feature (outline still works without it). */
    fullGeneration?: boolean;
}

export const COMMANDS: CommandInfo[] = [
    {
        command: { id: 'course', kind: 'job', job: 'blueprint', brief: 'course' },
        label: 'course',
        description: 'Plan and write a full course',
        placeholder: 'What should the course teach, and to whom?',
        icon: GraduationCap,
        fullGeneration: true,
    },
    {
        command: { id: 'exam', kind: 'job', job: 'blueprint', brief: 'exam' },
        label: 'exam',
        description: 'Build an exam from a topic or your course',
        placeholder: 'What should the exam assess?',
        icon: ClipboardCheck,
        fullGeneration: true,
    },
    {
        command: { id: 'quiz', kind: 'job', job: 'quiz', brief: 'exam' },
        label: 'quiz',
        description: 'Quick set of questions, ready to insert',
        placeholder: 'Topic for the quiz',
        icon: ListChecks,
    },
    {
        command: { id: 'edit', kind: 'chat', intent: 'edit' },
        label: 'edit',
        description: 'Change a course, exam or draft',
        placeholder: 'Which course or exam, and what should change?',
        icon: FilePen,
    },
    {
        command: { id: 'explain', kind: 'chat', intent: 'explain' },
        label: 'explain',
        description: 'Explain a concept with examples',
        placeholder: 'What concept, and for which level?',
        icon: Lightbulb,
    },
    {
        command: { id: 'improve', kind: 'chat', intent: 'improve' },
        label: 'improve',
        description: 'Rewrite content to be clearer',
        placeholder: 'Paste the text to improve',
        icon: PenLine,
    },
    {
        command: { id: 'rubric', kind: 'chat', intent: 'rubric' },
        label: 'rubric',
        description: 'Grading rubric for a task',
        placeholder: 'Describe the assignment',
        icon: FileQuestion,
    },
    {
        command: { id: 'summarize', kind: 'chat', intent: 'summarize' },
        label: 'summarize',
        description: 'Cheat sheet of key concepts',
        placeholder: 'What should be summarized?',
        icon: ScrollText,
    },
    {
        command: { id: 'lesson', kind: 'chat', intent: 'lesson' },
        label: 'lesson',
        description: 'Timed lesson plan with activities',
        placeholder: 'Lesson topic, class length and level',
        icon: BookOpenCheck,
    },
];

export const commandById = (id: string) => COMMANDS.find((c) => c.command.id === id);

export const STARTERS: { command: StudioCommand['id']; text: string }[] = [
    { command: 'course', text: 'Photosynthesis for grade 7 science' },
    { command: 'quiz', text: 'Python list slicing' },
    { command: 'explain', text: 'Recursion to first-year students, with a real-world analogy' },
    { command: 'rubric', text: 'A 500-word persuasive essay for grade 10' },
];
