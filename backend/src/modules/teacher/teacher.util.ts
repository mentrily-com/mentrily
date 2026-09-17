/**
 * Pure, dependency-free helpers shared across the teacher module's split
 * services (TeacherService, TeacherStatsService, TeacherStudentsService,
 * TeacherCoursesService, TeacherExamsService). None of these touch the
 * database or any injected service, so they live as plain functions rather
 * than methods on an injectable -- no DI wiring needed to share them.
 */

export function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseBoundedNumber(
  value: string | number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

export const legacyExamSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  longDescription: true,
  difficulty: true,
  tags: true,
  duration: true,
  totalMarks: true,
  testCode: true,
  testCodeType: true,
  rotationInterval: true,
  inviteToken: true,
  allowedIPs: true,
  examMode: true,
  aiProctoring: true,
  tabSwitchLimit: true,
  strictness: true,
  startTime: true,
  endTime: true,
  timeZone: true,
  questions: true,
  isActive: true,
  resultsPublished: true,
  aiTokensUsed: true,
  creatorId: true,
  linkedCourseId: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function isMissingExamAttemptFieldError(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    (error as any).code !== 'P2022'
  ) {
    return false;
  }

  const column = String((error as any)?.meta?.column || '');
  return (
    column.includes('passingPercentage') ||
    column.includes('maxAttempts') ||
    column.includes('attemptBufferMins')
  );
}

export function normalizeCourseStatus(
  status: unknown,
  isVisible?: boolean,
): 'Draft' | 'Published' | 'Archived' {
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'published') return 'Published';
    if (normalized === 'archived') return 'Archived';
    if (normalized === 'draft') return 'Draft';
  }

  if (typeof isVisible === 'boolean') {
    return isVisible ? 'Published' : 'Draft';
  }

  return isVisible ? 'Published' : 'Draft';
}

export function collectQuestionTypesFromUnits(units: any[]): Set<string> {
  const types = new Set<string>();
  for (const unit of units || []) {
    const normalizedType = String(unit?.type || '')
      .trim()
      .toLowerCase();
    if (normalizedType) {
      types.add(normalizedType);
    }
  }
  return types;
}

export function collectQuestionTypesFromExamContent(
  payload: unknown,
): Set<string> {
  const types = new Set<string>();

  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    const normalizedType = String(value.type || value.questionType || '')
      .trim()
      .toLowerCase();
    if (normalizedType) {
      types.add(normalizedType);
    }

    if (Array.isArray(value.questions)) {
      value.questions.forEach(visit);
    }
    if (Array.isArray(value.sections)) {
      value.sections.forEach(visit);
    }
  };

  visit(payload);
  return types;
}

export function certificateTypeFilter(type: 'course' | 'exam') {
  return { in: [type, type.toUpperCase()] };
}

export function formatMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0m';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function normalizeCourseSections(data: any): any[] {
  if (Array.isArray(data?.sections)) {
    return data.sections;
  }

  if (Array.isArray(data?.modules)) {
    return data.modules.map((module: any) => ({
      id: module.id,
      title: module.title,
      questions: Array.isArray(module.units)
        ? module.units.map((unit: any) => ({
            id: unit.id,
            title: unit.title,
            type: unit.type,
            ...(unit.content || {}),
          }))
        : [],
    }));
  }

  return [];
}

export function isUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
}
