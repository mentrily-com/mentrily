// Core Mentrily V2 Type Definitions

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'PARTNER' | 'SUPER_ADMIN';

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExamSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'TERMINATED';

export type QuestionType =
  | 'MCQ'
  | 'MULTIPLE_CHOICE'
  | 'CODING'
  | 'READING'
  | 'WEB'
  | 'NOTEBOOK';

export interface WebhookEventPayload<T = unknown> {
  id: string;
  event: string;
  createdAt: string;
  data: T;
  organizationId: string;
}

export interface ErpSyncResult {
  success: boolean;
  doctype: string;
  docname: string;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  error?: string;
}

export interface PartnerReferralData {
  partnerId: string;
  referralCode: string;
  referredUserId: string;
  organizationId?: string;
  commissionPercent: number;
}
