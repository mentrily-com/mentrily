interface StudentExamQuestionDto {
  id: string;
  [key: string]: any;
}

interface StudentExamSectionQuestionRefDto {
  id: string;
  status: string;
  number: number;
}

interface StudentExamSectionDto {
  id: string;
  title: string;
  status: string;
  questions: StudentExamSectionQuestionRefDto[];
  [key: string]: any;
}

interface StudentExamResponseDto {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  difficulty?: string;
  tags: string[];
  duration: number;
  totalMarks?: number;
  examMode: string;
  aiProctoring: boolean;
  tabSwitchLimit: number | null;
  startTime: string | Date | null;
  endTime: string | Date | null;
  timeZone: string | null;
  sections: StudentExamSectionDto[];
  questions: Record<string, StudentExamQuestionDto>;
}

export interface StudentExamSessionDto {
  id: string;
  status: string;
  startTime: string | Date;
  endTime?: string | Date | null;
  answers?: any;
  tabSwitchOutCount: number;
  tabSwitchInCount: number;
  feedbackDone: boolean;
}

interface ExamEnterResponseDto {
  session: StudentExamSessionDto;
  status: 'ready';
}

export function toStudentExamResponseDto(exam: any): StudentExamResponseDto {
  return {
    id: exam?.id,
    slug: exam?.slug,
    title: exam?.title,
    shortDescription: exam?.shortDescription || '',
    longDescription: exam?.longDescription || '',
    difficulty: exam?.difficulty,
    tags: Array.isArray(exam?.tags) ? exam.tags : [],
    duration: exam?.duration,
    totalMarks: exam?.totalMarks,
    examMode: exam?.examMode || 'Browser',
    aiProctoring: !!exam?.aiProctoring,
    tabSwitchLimit: exam?.tabSwitchLimit ?? null,
    startTime: exam?.startTime || null,
    endTime: exam?.endTime || null,
    timeZone: exam?.timeZone || null,
    sections: Array.isArray(exam?.sections) ? exam.sections : [],
    questions:
      exam?.questions && typeof exam.questions === 'object'
        ? exam.questions
        : {},
  };
}

/**
 * Grading internals live inside the answers JSONB (written by the flush
 * worker). They must never reach the student while an exam is running:
 * `_internal_marks` is a per-question correctness oracle — change an answer,
 * resume the exam, read whether it scored.
 */
function stripGradingInternals(answers: any): any {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return answers;
  }
  const safe = { ...answers };
  delete safe._internal_marks;
  delete safe._internal_score;
  return safe;
}

export function toStudentExamSessionDto(session: any): StudentExamSessionDto {
  const tabSwitchOutCount = Array.isArray(session?.violations)
    ? session.violations.filter(
        (v: any) => v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT',
      ).length
    : Number(session?.tabSwitchOutCount || 0);

  const tabSwitchInCount = Array.isArray(session?.violations)
    ? session.violations.filter((v: any) => v.type === 'TAB_SWITCH_IN').length
    : Number(session?.tabSwitchInCount || 0);

  return {
    id: session?.id,
    status: session?.status,
    startTime: session?.startTime,
    endTime: session?.endTime ?? null,
    answers: stripGradingInternals(session?.answers),
    tabSwitchOutCount,
    tabSwitchInCount,
    feedbackDone: !!session?.feedbackDone,
  };
}

export function toExamEnterResponseDto(session: any): ExamEnterResponseDto {
  return {
    session: toStudentExamSessionDto(session),
    status: 'ready',
  };
}
