import type { BriefInput } from '../prompts/generation.prompts';
import type { Blueprint } from '../schemas/generation.schemas';
import type { BuilderSection } from '../quality/normalize';
import type { AiActor, AiTier } from '../engine/ai-types';
import type { CreditReservation } from '../credits/ai-credits.service';

export type AiJobKind = 'blueprint' | 'generate' | 'quiz';
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

export interface AiJobInput {
  brief: BriefInput;
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

export type AiJobResult =
  | { type: 'blueprint'; blueprint: Blueprint }
  | { type: 'draft'; draft: AiDraft };

export interface AiJobPayload {
  jobId: string;
  actor: AiActor;
  reservation: CreditReservation;
}
