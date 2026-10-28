import { BadRequestException } from '@nestjs/common';
import { indexExamQuestions } from '../common/session-answers.util';
import { SubmissionService } from './submission.service';
import { ExamService } from '../exam/exam.service';

const questions = [
  { id: 's1', questions: [{ id: 'q1', type: 'MCQ', mcqOptions: [] }] },
  { id: 's2', questions: [{ id: 'q2', type: 'CODING', marks: 4 }] },
];

function setup(
  dbAnswers: Record<string, unknown>,
  stash: Record<string, string>,
) {
  const calls: string[] = [];
  const redis: any = {
    get: jest.fn().mockResolvedValue(null),
    hgetall: jest.fn().mockImplementation((key: string) => {
      calls.push(`redis:${key}`);
      if (key.startsWith('session:answers:h:')) return Promise.resolve(stash);
      if (key.startsWith('exam:coding-result:'))
        return Promise.resolve({
          q2: JSON.stringify({ passed: 1, total: 2, at: 1 }),
        });
      return Promise.resolve({});
    }),
    del: jest.fn().mockResolvedValue(1),
  };
  const prisma: any = {
    examSession: {
      findUnique: jest.fn().mockImplementation(() => {
        calls.push('db:read');
        return Promise.resolve({
          answers: dbAnswers,
          status: 'IN_PROGRESS',
          userId: 'u1',
          startTime: new Date(),
          examId: 'e1',
        });
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const examService: any = {
    filterAnswersForExam: (id: string, staged: any, stored: any) =>
      ExamService.prototype.filterAnswersForExam.call(
        {
          getExamGradingData: () =>
            Promise.resolve({
              questions,
              orgId: 'org1',
              index: indexExamQuestions(questions),
            }),
        },
        id,
        staged,
        stored,
      ),
    calculateScoreDetails: (a: any, q: any) =>
      ExamService.prototype.calculateScoreDetails.call({}, a, q),
    handleExamCompletion: jest.fn().mockResolvedValue({}),
  };
  const analytics: any = { add: jest.fn().mockResolvedValue({}) };
  const webhooks: any = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const service = new SubmissionService(
    {} as any,
    analytics,
    redis,
    { legacyPrisma: prisma } as any,
    examService,
    webhooks,
  );
  return { service, prisma, calls, analytics, webhooks, examService };
}

describe('SubmissionService.submitExamNow', () => {
  it('filters final answers like a flush, grades coding from the server record, and reads the stash first', async () => {
    const { service, prisma, calls } = setup(
      { q1: 'old', _section_s1_submitted: true },
      { q2: JSON.stringify({ code: 'x' }), junk: '"x"' },
    );

    const result = await service.submitExamNow('sess', {
      q1: 'changed-after-lock',
      q2: { code: 'y', testResults: [{ passed: true }, { passed: true }] },
      _internal_marks: { q2: 4 }, // echoed back by a resumed client: ignored
      _internal_metadata: { name: 'spoof' },
    });

    const written = prisma.examSession.updateMany.mock.calls[0][0].data.answers;
    expect(written.q1).toBe('old'); // section s1 locked in DB
    expect(written.junk).toBeUndefined();
    expect(written.q2).toEqual({
      code: 'y',
      testResults: [{ passed: true }, { passed: true }],
    });
    expect(written._internal_metadata).toBeUndefined();
    expect(written['_internal_coding:q2']).toEqual({
      passed: 1,
      total: 2,
      at: 1,
    });
    expect(written._internal_marks.q2).toBe(2);
    expect(result.earnedMarks).toBe(2);
    expect(calls.indexOf('db:read')).toBeGreaterThan(
      calls.indexOf('redis:session:answers:h:sess'),
    );
  });

  it('rejects invalid final answers', async () => {
    const { service } = setup({}, {});
    await expect(
      service.submitExamNow('sess', { q1: 'a\u0000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fires the same completion side effects as auto-submit', async () => {
    const { service, analytics, webhooks, examService } = setup({}, {});
    await service.submitExamNow('sess', {});
    await new Promise((r) => setImmediate(r));
    expect(analytics.add).toHaveBeenCalledWith('update-streak', {
      userId: 'u1',
    });
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'org1',
      'exam.completed',
      expect.objectContaining({ sessionId: 'sess', examId: 'e1' }),
    );
    expect(examService.handleExamCompletion).toHaveBeenCalledWith('sess');
  });
});
