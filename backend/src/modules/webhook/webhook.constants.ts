export const WEBHOOK_EVENTS = [
  'student.enrolled',
  'exam.completed',
  'score.below_threshold',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
