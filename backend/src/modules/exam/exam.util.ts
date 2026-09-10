/**
 * Pure, dependency-free exam helpers: attempt-field/session-field Prisma
 * error detection, question counting, and the exam/course-test/course
 * content transform pipeline used to shape raw DB rows into what the
 * frontend consumes. None of these touch the database or any injected
 * service, so they live as plain functions -- split out of ExamService to
 * keep that file's actual service surface (session lifecycle, access
 * control, scoring) smaller and this transform logic independently
 * testable. ExamService.transformExam/transformCourseTest/transformCourse
 * stay as thin delegating methods since other services call them via
 * `examService.transformExam(...)`.
 */
import { sanitizeQuestionForClient } from '../common/testcase-visibility.util';
import { toStudentExamResponseDto } from './dto/exam-response.dto';

export function isMissingExamAttemptFieldError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as any).code === 'P2022' &&
    (String((error as any)?.meta?.column || '').includes(
      'Exam.passingPercentage',
    ) ||
      String((error as any)?.meta?.column || '').includes('Exam.maxAttempts') ||
      String((error as any)?.meta?.column || '').includes(
        'Exam.attemptBufferMins',
      ))
  );
}

export function isMissingExamSessionAttemptNumberError(
  error: unknown,
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as any).code === 'P2022' &&
    String((error as any)?.meta?.column || '').includes(
      'ExamSession.attemptNumber',
    )
  );
}
export function countQuestions(questions: any): {
  totalQuestions: number;
  totalSections: number;
} {
  const rawQuestions: any = questions || {};
  let totalQuestions = 0;
  let totalSections = 0;

  if (rawQuestions.sections && Array.isArray(rawQuestions.sections)) {
    totalSections = rawQuestions.sections.length;
    rawQuestions.sections.forEach((s: any) => {
      if (Array.isArray(s.questions)) {
        totalQuestions += s.questions.length;
      }
    });
  } else if (Array.isArray(rawQuestions)) {
    totalSections = 1;
    totalQuestions = rawQuestions.length;
  } else if (Object.keys(rawQuestions).length > 0) {
    totalSections = 1;
    totalQuestions = Object.keys(rawQuestions).length;
  }

  return { totalQuestions, totalSections };
}

export function normalizeType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('multi') || t.includes('select')) return 'MultiSelect';
  if (t.includes('mcq') || t.includes('quiz') || t.includes('choice'))
    return 'MCQ';
  if (t.includes('code') || t.includes('coding') || t.includes('program'))
    return 'Coding';
  if (t.includes('web') || t.includes('html')) return 'Web';
  if (t.includes('read') || t.includes('text') || t.includes('lesson'))
    return 'Reading';
  if (t.includes('notebook') || t.includes('jupyter')) return 'Notebook';
  return 'MCQ'; // Default fallback
}

export function transformExam(exam: any, includeSensitive: boolean = true) {
  const questionsMap: Record<string, any> = {};
  const finalSections: any[] = [];

  // 1. Build a comprehensive map of all items found in the 'questions' JSON
  // This handles cases where 'questions' is a map of sections, or just an array
  const rawQuestions = exam.questions || {};
  const sourceMap =
    rawQuestions.sections || !Array.isArray(rawQuestions)
      ? rawQuestions.sections || rawQuestions
      : {};
  const sourceArray = Array.isArray(rawQuestions)
    ? rawQuestions
    : Object.values(sourceMap);

  const registerQuestion = (q: any, parentId?: string, index?: number) => {
    const qId = q.id || `${parentId || 'q'}-${index || Math.random()}`;
    const normalizedQ = {
      ...q,
      id: qId,
      title: q.title || `Question ${index || ''}`,
      description: q.problemStatement || q.description || '',
      type: normalizeType(q.type || 'MCQ'),
      mcqOptions: q.mcqOptions || q.options || q.mcq?.options,
      codingConfig: q.codingConfig || q.coding,
      webConfig: q.webConfig || q.web,
      readingContent:
        q.readingContent || q.readingConfig?.contentBlocks || q.readingConfig,
    };
    questionsMap[qId] = sanitizeQuestionForClient(
      normalizedQ,
      includeSensitive,
    );
    return qId;
  };

  // Pre-fill map from source
  sourceArray.forEach((item: any) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item.questions)) {
      item.questions.forEach((q: any, i: number) =>
        registerQuestion(q, item.id || 'sec', i + 1),
      );
    } else {
      registerQuestion(item);
    }
  });

  // 2. Process existing sections structure if present in DB
  if (Array.isArray(exam.sections) && exam.sections.length > 0) {
    exam.sections.forEach((s: any, sIdx: number) => {
      const sectionQuestions: any[] = [];
      (s.questions || []).forEach((sq: any) => {
        // Check if this ID points to a section entry in our source map
        const sourceItem = sourceMap[sq.id];
        if (sourceItem && Array.isArray(sourceItem.questions)) {
          // Spread sub-questions into this section
          sourceItem.questions.forEach((lq: any, lqIdx: number) => {
            const lqId = registerQuestion(lq, sourceItem.id, lqIdx + 1);
            sectionQuestions.push({
              id: lqId,
              status: 'unanswered',
              number: sectionQuestions.length + 1,
            });
          });
        } else if (questionsMap[sq.id]) {
          // Standard question
          sectionQuestions.push({
            ...sq,
            number: sectionQuestions.length + 1,
          });
        }
      });

      if (sectionQuestions.length > 0) {
        finalSections.push({
          ...s,
          status: sIdx === 0 ? 'active' : 'locked',
          questions: sectionQuestions,
        });
      }
    });
  }

  // 3. If no sections were built from Step 2, build from Step 1's source map
  if (finalSections.length === 0) {
    sourceArray.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return;

      const sectionQuestions: any[] = [];
      if (Array.isArray(item.questions)) {
        item.questions.forEach((q: any, qIdx: number) => {
          const qId = registerQuestion(q, item.id, qIdx + 1);
          sectionQuestions.push({
            id: qId,
            status: 'unanswered',
            number: sectionQuestions.length + 1,
          });
        });

        finalSections.push({
          id: item.id || `s${idx + 1}`,
          title: item.title || `Section ${idx + 1}`,
          status: finalSections.length === 0 ? 'active' : 'locked',
          questions: sectionQuestions,
        });
      } else {
        // Handle flat questions by grouping into a default section
        const qId = registerQuestion(item, 'q', idx + 1);
        const defaultSection = finalSections.find(
          (fs) => fs.id === 'default-section',
        );
        if (defaultSection) {
          defaultSection.questions.push({
            id: qId,
            status: 'unanswered',
            number: defaultSection.questions.length + 1,
          });
        } else {
          finalSections.push({
            id: 'default-section',
            title: 'Assessment',
            status: 'active',
            questions: [{ id: qId, status: 'unanswered', number: 1 }],
          });
        }
      }
    });
  }

  const transformed = {
    ...exam,
    sections: finalSections,
    questions: questionsMap,
  };

  if (!includeSensitive) {
    return toStudentExamResponseDto(transformed);
  }

  return transformed;
}

export function transformCourseTest(
  test: any,
  includeSensitive: boolean = true,
) {
  // Course Tests are already stored with 'questions' which is the sections JSON
  const questionsData = test.questions;
  // Handle both: arrays (sections list) or object with sections key
  const sections = Array.isArray(questionsData)
    ? questionsData
    : questionsData.sections || [];

  const questionsMap: Record<string, any> = {};

  // Normalize types and preserve all fields
  const normalizedSections = sections.map((s: any) => ({
    ...s,
    questions: s.questions.map((q: any) => {
      const normalizedType = normalizeType(q.type || 'MCQ');
      const normalizedQ = {
        ...q,
        id: q.id,
        title: q.title || 'Untitled Question',
        description: q.problemStatement || q.description || '', // Support both field names
        type: normalizedType,
        // Preserve specific configs if they exist, or map from flat structure if needed
        mcqOptions: q.mcqOptions || q.options,
        codingConfig: q.codingConfig || q.coding,
        webConfig: q.webConfig || q.web,
        readingContent:
          q.readingContent || q.readingConfig?.contentBlocks || q.readingConfig,
      };

      const safeQ = sanitizeQuestionForClient(normalizedQ, includeSensitive);

      // Ensure map gets the full object
      questionsMap[q.id] = safeQ;
      return safeQ;
    }),
  }));

  let duration = 60;
  if (test.startDate && test.endDate) {
    const diffMs =
      new Date(test.endDate).getTime() - new Date(test.startDate).getTime();
    duration = Math.floor(diffMs / 60000);
  }

  return {
    id: test.id,
    title: test.title,
    slug: test.slug,
    duration: duration,
    sections: normalizedSections,
    questions: questionsMap, // This is critical for looking up current question
    isCourseTest: true,
    courseTitle: test.course?.title,
  };
}

export function transformCourse(course: any, includeSensitive: boolean = true) {
  const questionsMap: Record<string, any> = {};
  const sections = course.modules.map((m: any, mIdx: number) => {
    const questions = m.units.map((u: any, uIdx: number) => {
      const qId = u.id;
      // Transform Unit to UnitQuestion format
      const unitContent = u.content;
      const normalizedType = normalizeType(u.type);

      const normalizedUnit = {
        ...unitContent,
        id: qId,
        title: u.title,
        type: normalizedType,
      };
      questionsMap[qId] = sanitizeQuestionForClient(
        normalizedUnit,
        includeSensitive,
      );
      return { id: qId, status: 'unanswered', number: uIdx + 1 };
    });

    return {
      id: m.id,
      title: m.title,
      status: mIdx === 0 ? 'active' : 'locked',
      questions: questions,
    };
  });

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    sections: sections,
    questions: questionsMap,
    isCourse: true,
  };
}
