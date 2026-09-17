import type { BriefInput } from '../prompts/generation.prompts';
import type { Blueprint } from '../schemas/generation.schemas';
import type {
  BuilderQuestion,
  BuilderSection,
  GeneratedQuestion,
} from '../quality/normalize';
import type { AiActor, AiTier } from '../engine/ai-types';
import type { CreditReservation } from '../credits/ai-credits.service';

export type AiJobKind = 'blueprint' | 'generate' | 'quiz' | 'edit';
export type AiJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ContentReference {
  kind: 'course' | 'exam';
  id: string;
  title?: string;
}

/** What an edit job changes: a draft from a previous job, or saved content. */
export interface EditTargetRef {
  type: 'draft' | 'course' | 'exam';
  id: string;
}

export interface EditJobInput {
  target: EditTargetRef;
  instruction: string;
}

export interface AiJobInput {
  /** Edit jobs derive this from the target (used when writing new items). */
  brief: BriefInput;
  edit?: EditJobInput;
  blueprint?: Blueprint;
  references: ContentReference[];
  referenceText?: string;
  tier: AiTier;
  verifyCoding: boolean;
  parentJobId?: string;
}

export interface AiJobSectionProgress {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  questionCount: number;
  preview?: { title: string; type: string; status: string }[];
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

export interface AiDraft {
  kind: 'course' | 'exam';
  title: string;
  description: string;
  summary?: string;
  sections: BuilderSection[];
  totalMarks: number;
  stats: {
    questions: number;
    verified: number;
    needsReview: number;
  };
}

/**
 * One proposed change. Every change carries what it needs to be applied
 * and to be undone (the "before" side), so undo never needs a snapshot of
 * the whole course.
 */
export type EditChange =
  | {
      id: string;
      kind: 'edit_item';
      summary: string;
      sectionId: string;
      itemId: string;
      before: BuilderQuestion;
      after: GeneratedQuestion;
    }
  | {
      id: string;
      kind: 'add_item';
      summary: string;
      sectionId: string;
      index: number;
      after: GeneratedQuestion;
    }
  | {
      id: string;
      kind: 'remove_item';
      summary: string;
      sectionId: string;
      index: number;
      before: BuilderQuestion;
    }
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
      before: { title: string; items: BuilderQuestion[] };
    }
  | {
      id: string;
      kind: 'rename_section';
      summary: string;
      sectionId: string;
      before: string;
      after: string;
    }
  | {
      id: string;
      kind: 'update_details';
      summary: string;
      before: { title: string; description: string };
      after: { title: string; description: string };
    };

export interface EditTarget extends EditTargetRef {
  kind: 'course' | 'exam';
  title: string;
  /** Learners can see it right now (published course / active exam). */
  live: boolean;
}

export interface ChangeSet {
  target: EditTarget;
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
      /** Set when this draft is an AI edit of a previous draft version. */
      edit?: { summary: string; changes: EditChange[] };
      /** Set once the draft has been saved as a course or exam. */
      savedAs?: { kind: 'course' | 'exam'; id: string };
    }
  | { type: 'changeset'; changeset: ChangeSet };

export interface AiJobPayload {
  jobId: string;
  actor: AiActor;
  reservation: CreditReservation;
}
