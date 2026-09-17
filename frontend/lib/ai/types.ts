import type { Question, QuestionType } from '@/app/components/Authoring/types';

export type AiKind = 'course' | 'exam';
export type AiDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';
export type AiGenerationType = Exclude<QuestionType, 'Descriptive'>;
export type AiQuality = 'standard' | 'pro';

export interface AiBrief {
    kind: AiKind;
    topic: string;
    audience?: string;
    outcomes?: string;
    language?: string;
    sections: number;
    questionsPerSection: number;
    types: AiGenerationType[];
    difficulty: AiDifficulty;
    totalMarks?: number;
    codingLanguages?: ('python' | 'javascript')[];
}

export interface AiReference {
    kind: 'course' | 'exam';
    id: string;
    title?: string;
}

export interface BlueprintQuestion {
    id: string;
    type: AiGenerationType;
    title: string;
    intent: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    marks: number;
}

export interface BlueprintSection {
    id: string;
    title: string;
    summary: string;
    questions: BlueprintQuestion[];
}

export interface Blueprint {
    kind: AiKind;
    title: string;
    description: string;
    sections: BlueprintSection[];
}

export type AiReviewStatus = 'ok' | 'verified' | 'needs_review' | 'unverified';

export interface AiQuestionMeta {
    status: AiReviewStatus;
    issues: string[];
}

export type GeneratedQuestion = Question & { aiMeta: AiQuestionMeta };

export interface GeneratedSection {
    id: string;
    title: string;
    questions: GeneratedQuestion[];
}

export interface AiDraft {
    kind: AiKind;
    title: string;
    description: string;
    summary?: string;
    sections: GeneratedSection[];
    totalMarks: number;
    stats: { questions: number; verified: number; needsReview: number };
}

export type AiJobKind = 'blueprint' | 'generate' | 'quiz' | 'edit';
export type AiJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AiJobSectionProgress {
    id: string;
    title: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    questionCount: number;
    preview?: { title: string; type: string; status: AiReviewStatus }[];
    error?: string;
}

export interface AiJobProgress {
    stage: 'queued' | 'outline' | 'sections' | 'summary' | 'done';
    message: string;
    completed: number;
    total: number;
    creditsUsed: number;
    sections: AiJobSectionProgress[];
}

/** One AI-proposed change to a course, exam or draft (mirrors the backend). */
export type EditChange =
    | {
          id: string;
          kind: 'edit_item';
          summary: string;
          sectionId: string;
          itemId: string;
          before: GeneratedQuestion;
          after: GeneratedQuestion;
      }
    | { id: string; kind: 'add_item'; summary: string; sectionId: string; index: number; after: GeneratedQuestion }
    | { id: string; kind: 'remove_item'; summary: string; sectionId: string; index: number; before: GeneratedQuestion }
    | {
          id: string;
          kind: 'move_item';
          summary: string;
          itemId: string;
          from: { sectionId: string; index: number };
          to: { sectionId: string; index: number };
      }
    | {
          id: string;
          kind: 'add_section';
          summary: string;
          sectionId: string;
          index: number;
          title: string;
          items: GeneratedQuestion[];
      }
    | {
          id: string;
          kind: 'remove_section';
          summary: string;
          sectionId: string;
          index: number;
          before: { title: string; items: GeneratedQuestion[] };
      }
    | { id: string; kind: 'rename_section'; summary: string; sectionId: string; before: string; after: string }
    | {
          id: string;
          kind: 'update_details';
          summary: string;
          before: { title: string; description: string };
          after: { title: string; description: string };
      };

export interface ChangeSet {
    target: { type: 'draft' | 'course' | 'exam'; id: string; kind: AiKind; title: string; live: boolean };
    summary: string;
    changes: EditChange[];
    applied?: { at: string; changeIds: string[] };
    undone?: { at: string };
}

export type AiJobResult =
    | { type: 'blueprint'; blueprint: Blueprint }
    | {
          type: 'draft';
          draft: AiDraft;
          edit?: { summary: string; changes: EditChange[] };
          savedAs?: { kind: AiKind; id: string };
      }
    | { type: 'changeset'; changeset: ChangeSet };

export interface AiJob {
    id: string;
    kind: AiJobKind;
    status: AiJobStatus;
    progress: AiJobProgress | null;
    result: AiJobResult | null;
    error: string | null;
    creditsReserved: number;
    creditsUsed: number;
    createdAt: string;
    finishedAt: string | null;
    brief?: AiBrief;
    references: AiReference[];
}

export interface AiUsage {
    plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    period: string;
    resetsAt: string;
    credits: { used: number; limit: number; remaining: number };
    messages: { usedToday: number; limit: number };
    limits: { maxQuestionsPerGeneration: number; concurrentJobs: number; maxReferences: number };
    features: { aiStudio: boolean; aiExams: boolean; aiProTier: boolean };
    byOperation: { operation: string; credits: number }[];
}

export interface AiContentRef {
    kind: 'course' | 'exam';
    id: string;
    title: string;
    updatedAt: string;
    status?: string;
}

export interface AiConversationSummary {
    id: string;
    title: string;
    pinned: boolean;
    lastMessageAt: string;
}

export type QuestionOp = 'improve' | 'harder' | 'easier' | 'distractors' | 'testcases' | 'solution' | 'regenerate';
