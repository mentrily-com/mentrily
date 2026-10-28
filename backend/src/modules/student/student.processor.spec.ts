import { StudentProcessor } from './student.processor';

describe('StudentProcessor', () => {
  let prisma: any;
  let certificateService: any;
  let processor: StudentProcessor;
  const run = (name: string, data: any) =>
    processor.process({ id: '1', name, data } as any);

  beforeEach(() => {
    prisma = {
      questionAttempt: { findFirst: jest.fn(), create: jest.fn() },
      user: { update: jest.fn() },
      course: { findUnique: jest.fn() },
      unitSubmission: { findMany: jest.fn().mockResolvedValue([]) },
      courseProgress: { upsert: jest.fn() },
    };
    certificateService = { generateCertificate: jest.fn() };
    processor = new StudentProcessor(
      { legacyPrisma: prisma } as any,
      certificateService,
    );
  });

  describe('save-question-attempt XP', () => {
    const job = {
      userId: 'u1',
      itemId: 'q1',
      type: 'EXAM',
      sessionId: 's1',
      content: 'a',
      isCorrect: true,
    };

    it('awards XP for the first correct attempt', async () => {
      prisma.questionAttempt.findFirst.mockResolvedValue(null);
      await run('save-question-attempt', job);
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('does not re-award XP when the question was already answered correctly in the session', async () => {
      prisma.questionAttempt.findFirst
        .mockResolvedValueOnce({ content: 'b' }) // dedupe check: answer changed
        .mockResolvedValueOnce({ id: 'earlier' }); // prior correct attempt
      await run('save-question-attempt', job);
      expect(prisma.questionAttempt.create).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(
        prisma.questionAttempt.findFirst.mock.calls[1][0].where,
      ).toMatchObject({
        userId: 'u1',
        itemId: 'q1',
        sessionId: 's1',
        isCorrect: true,
      });
    });

    it('reuses a caller-written attempt row and excludes it from the prior check', async () => {
      prisma.questionAttempt.findFirst.mockResolvedValue(null);
      await run('save-question-attempt', {
        ...job,
        type: 'UNIT',
        sessionId: undefined,
        attemptId: 'a1',
      });
      expect(prisma.questionAttempt.create).not.toHaveBeenCalled();
      expect(
        prisma.questionAttempt.findFirst.mock.calls[0][0].where,
      ).toMatchObject({
        sessionId: null,
        id: { not: 'a1' },
      });
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });
  });

  it('skips progress and certificates for learners not enrolled in the course', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      students: [],
      modules: [{ units: [{ id: 'unit1' }] }],
      certificateTemplateId: 't1',
    });
    await run('update-course-progress', { userId: 'u1', courseId: 'c1' });
    expect(prisma.courseProgress.upsert).not.toHaveBeenCalled();
    expect(certificateService.generateCertificate).not.toHaveBeenCalled();
  });
});
