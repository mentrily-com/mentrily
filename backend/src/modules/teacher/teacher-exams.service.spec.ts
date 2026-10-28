import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { TeacherExamsService } from './teacher-exams.service';
import { TeacherService } from './teacher.service';
import { TeacherCoursesService } from './teacher-courses.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { MonitoringGateway } from '../monitoring/monitoring.gateway';
import { ExamService } from '../exam/exam.service';
import { QuotaService } from '../billing/quota.service';

describe('TeacherExamsService', () => {
  let service: TeacherExamsService;
  let prisma: any;
  let redis: any;
  let teacherService: any;
  let gateway: any;
  let multi: any;

  beforeEach(async () => {
    prisma = {
      exam: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      examSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      feedback: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    multi = {
      del: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
      multi: jest.fn(() => multi),
    };
    gateway = { forceTerminate: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherExamsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: prisma },
        },
        {
          provide: TeacherService,
          useValue: {
            checkAccess: jest.fn(),
            canUseCustomSlug: jest.fn(),
            createUniqueSlug: jest.fn(),
            createExamRecordWithRetry: jest.fn(),
            findExamByIdCompat: jest.fn(),
            assertLinkableCourse: jest.fn(),
            enforceQuestionTypeAccess: jest.fn(),
            invalidateTeacherExamListCache: jest.fn(),
          },
        },
        {
          provide: TeacherCoursesService,
          useValue: { linkExamToCourse: jest.fn() },
        },
        { provide: MonitoringGateway, useValue: gateway },
        {
          provide: ExamService,
          useValue: {
            transformExam: jest.fn(),
            calculateScoreDetails: jest
              .fn()
              .mockReturnValue({ totalMarks: 20 }),
          },
        },
        {
          provide: QuotaService,
          useValue: { checkQuestionTypeAllowed: jest.fn() },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: redis,
        },
        {
          provide: getQueueToken('exam-invite-email'),
          useValue: { add: jest.fn(), addBulk: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherExamsService>(TeacherExamsService);
    teacherService = module.get(TeacherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const sqlOf = (call: any[]) => (call[0] as TemplateStringsArray).join('?');
  const exam = { id: 'exam-1', slug: 'e1', orgId: 'org-1', creatorId: 't1' };
  const user = { id: 't1', role: 'TEACHER', orgId: 'org-1' };

  describe('terminateExamSession', () => {
    it('only terminates IN_PROGRESS sessions', async () => {
      prisma.exam.findFirst.mockResolvedValue(exam);
      prisma.examSession.findMany.mockResolvedValue([{ id: 's1' }]);

      await service.terminateExamSession('exam-1', 'stu', user);

      expect(prisma.examSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { examId: 'exam-1', userId: 'stu', status: 'IN_PROGRESS' },
        }),
      );
      expect(sqlOf(prisma.$executeRaw.mock.calls[0])).toContain(
        `"status" = 'IN_PROGRESS'`,
      );
      expect(redis.del).toHaveBeenCalledWith(
        'session:status:s1',
        'session:meta:s1',
        'teacher:monitored:exam-1',
      );
    });

    it('writes nothing when the student has no live attempt', async () => {
      prisma.exam.findFirst.mockResolvedValue(exam);
      prisma.examSession.findMany.mockResolvedValue([]);

      await service.terminateExamSession('exam-1', 'stu', user);

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('unterminateExamSession', () => {
    beforeEach(() => prisma.exam.findFirst.mockResolvedValue(exam));

    it('reopens only the latest TERMINATED session and resets counters', async () => {
      prisma.examSession.findFirst.mockResolvedValue({ id: 's9' });

      await service.unterminateExamSession('exam-1', 'stu', user);

      expect(prisma.examSession.findFirst).toHaveBeenCalledWith({
        where: { examId: 'exam-1', userId: 'stu', status: 'TERMINATED' },
        orderBy: { startTime: 'desc' },
        select: { id: true },
      });
      const sql = sqlOf(prisma.$executeRaw.mock.calls[0]);
      expect(sql).toContain(`"status" = 'TERMINATED'`);
      expect(sql).toContain('NOT EXISTS');
      expect(multi.del).toHaveBeenCalledWith(
        'session:status:s9',
        'session:meta:s9',
        'teacher:monitored:exam-1',
      );
      expect(multi.set).toHaveBeenCalledWith(
        'violation:count:in:s9',
        '0',
        'EX',
        21600,
      );
      expect(multi.set).toHaveBeenCalledWith(
        'violation:count:out:s9',
        '0',
        'EX',
        21600,
      );
    });

    it('rejects when nothing is terminated', async () => {
      prisma.examSession.findFirst.mockResolvedValue(null);
      await expect(
        service.unterminateExamSession('exam-1', 'stu', user),
      ).rejects.toThrow('No terminated session');
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('rejects when another attempt is already live', async () => {
      prisma.examSession.findFirst.mockResolvedValue({ id: 's9' });
      prisma.$executeRaw.mockResolvedValue(0);
      await expect(
        service.unterminateExamSession('exam-1', 'stu', user),
      ).rejects.toThrow('active attempt');
      expect(redis.multi).not.toHaveBeenCalled();
    });
  });

  describe('updateSubmissionScore', () => {
    it('stores a percentage and merges internal fields in SQL', async () => {
      prisma.examSession.findUnique.mockResolvedValue({
        id: 's1',
        exam: { ...exam, totalMarks: 20, questions: [] },
      });

      const res = await service.updateSubmissionScore('s1', 15, user, {
        q1: 10,
        q2: 5,
        bad: 'x' as any,
      });

      expect(res).toEqual({
        id: 's1',
        score: 75,
        earnedMarks: 15,
        totalMarks: 20,
        percentage: 75,
      });
      const call = prisma.$executeRaw.mock.calls[0];
      expect(sqlOf(call)).toContain(`COALESCE("answers", '{}'::jsonb) ||`);
      expect(call[1]).toBe(75);
      expect(JSON.parse(call[2])).toEqual({
        _internal_score: { earnedMarks: 15, totalMarks: 20, percentage: 75 },
        _internal_marks: { q1: 10, q2: 5 },
      });
    });

    it('clamps marks above the total to 100%', async () => {
      prisma.examSession.findUnique.mockResolvedValue({
        id: 's1',
        exam: { ...exam, totalMarks: 20, questions: [] },
      });
      const res = await service.updateSubmissionScore('s1', 99, user);
      expect(res.score).toBe(100);
    });
  });

  describe('updateExam', () => {
    it('drops session meta caches for live sessions when duration changes', async () => {
      teacherService.findExamByIdCompat.mockResolvedValue({
        ...exam,
        duration: 60,
      });
      teacherService.canUseCustomSlug.mockResolvedValue(false);
      prisma.exam.update.mockResolvedValue({ ...exam, duration: 90 });
      prisma.examSession.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      await service.updateExam('exam-1', user, { duration: 90 });

      expect(prisma.examSession.findMany).toHaveBeenCalledWith({
        where: { examId: 'exam-1', status: 'IN_PROGRESS' },
        select: { id: true },
      });
      expect(redis.del).toHaveBeenCalledWith(
        'session:meta:a',
        'session:meta:b',
      );
    });

    it('leaves session meta alone when duration is unchanged', async () => {
      teacherService.findExamByIdCompat.mockResolvedValue({
        ...exam,
        duration: 60,
      });
      teacherService.canUseCustomSlug.mockResolvedValue(false);
      prisma.exam.update.mockResolvedValue({ ...exam, duration: 60 });

      await service.updateExam('exam-1', user, { title: 'x' });

      expect(prisma.examSession.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getMonitoredStudents', () => {
    const row = {
      id: 's1',
      userId: 'u1',
      status: 'IN_PROGRESS',
      startTime: new Date(),
      endTime: null,
      updatedAt: new Date(),
      ipAddress: '1.2.3.4',
      vmDetected: false,
      sessionMetadata: { name: 'Ann' },
      user_id: 'u1',
      user_name: 'Ann',
      user_email: 'a@x',
      user_rollNumber: '7',
      total: 9,
      tabOuts: 3,
      tabIns: 3,
      vmCount: 0,
      vmType: null,
      recent: [
        { type: 'TAB_SWITCH_OUT', message: null, timestamp: new Date() },
      ],
    };

    beforeEach(() =>
      prisma.exam.findUnique.mockResolvedValue({ ...exam, duration: 60 }),
    );

    it('uses a minimal exam select and returns SQL-aggregated counts', async () => {
      prisma.$queryRaw.mockResolvedValue([row]);

      const [student] = await service.getMonitoredStudents('exam-1', user);

      expect(prisma.exam.findUnique.mock.calls[0][0].select.questions).toBe(
        undefined,
      );
      expect(student).toMatchObject({
        id: 'u1',
        sessionId: 's1',
        tabOuts: 3,
        tabIns: 3,
        isHighRisk: true,
        vmDetected: false,
        violationCounts: { total: 9, tabOuts: 3, tabIns: 3, vmDetected: 0 },
      });
      expect(student.logs).toEqual([
        expect.objectContaining({
          event: 'Tab Switch Out',
          description: 'No details',
        }),
      ]);
      expect(redis.set).toHaveBeenCalledWith(
        'teacher:monitored:exam-1',
        expect.any(String),
        'EX',
        3,
      );
    });

    it('coalesces concurrent rebuilds into one query', async () => {
      let release: (v: any) => void = () => undefined;
      prisma.$queryRaw.mockReturnValue(new Promise((r) => (release = r)));

      const a = service.getMonitoredStudents('exam-1', user);
      const b = service.getMonitoredStudents('exam-1', user);
      await new Promise((r) => setImmediate(r));
      release([row]);

      const [ra, rb] = await Promise.all([a, b]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(ra).toEqual(rb);
    });
  });

  describe('getExams', () => {
    it('omits questions and fills section counts from SQL', async () => {
      prisma.exam.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'exam-1', title: 'T' }]);
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'exam-1',
          sections: [{ id: 'sec-1', title: 'S', questionCount: 2 }],
        },
      ]);

      const res = await service.getExams(user);

      expect(prisma.exam.findMany.mock.calls[0][0].omit).toEqual({
        questions: true,
      });
      expect(res).toEqual([
        {
          id: 'exam-1',
          title: 'T',
          questions: [{ id: 'sec-1', title: 'S', questionCount: 2 }],
        },
      ]);
    });
  });

  describe('getExamResults pass/fail', () => {
    // session.score is a percentage; exam is 10 marks with a 50% pass mark.
    it('compares percentage scores against the exam passingPercentage', async () => {
      teacherService.findExamByIdCompat.mockResolvedValue({
        id: 'e1',
        questions: [{ id: 's1', questions: [{ id: 'q1', marks: 10 }] }],
      });
      prisma.exam.findUnique.mockResolvedValue({ passingPercentage: 50 });
      prisma.examSession.count = jest.fn().mockResolvedValue(2);
      const row = (id: string, score: number) => ({
        id,
        startTime: new Date(),
        endTime: new Date(),
        score,
        status: 'COMPLETED',
        metadata: {},
        submittedCount: 1,
        user_email: `${id}@x.com`,
      });
      prisma.$queryRaw
        .mockResolvedValueOnce([row('a', 40), row('b', 80)])
        .mockResolvedValueOnce([
          { totalScore: 120, highScore: 80, totalCount: 2, passedCount: 1 },
        ]);

      const res = await service.getExamResults('e1', {
        id: 'u1',
        role: 'TEACHER',
      });

      expect(res.results.map((r: any) => r.status)).toEqual([
        'Failed',
        'Passed',
      ]);
      expect(res.results[1].marksObtained).toBe(8);
      // Aggregate SQL uses the percentage threshold (50), not 0.4 * totalMarks.
      expect(prisma.$queryRaw.mock.calls[1].slice(1)).toContain(50);
    });

    it('falls back to 40% when passingPercentage is unavailable', async () => {
      teacherService.findExamByIdCompat.mockResolvedValue({
        id: 'e1',
        totalMarks: 10,
        questions: [],
      });
      prisma.exam.findUnique.mockRejectedValue(
        new Error('column does not exist'),
      );
      prisma.examSession.count = jest.fn().mockResolvedValue(1);
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'a',
            startTime: new Date(),
            endTime: null,
            score: 40,
            status: 'COMPLETED',
            metadata: {},
            submittedCount: 0,
            user_email: 'a@x.com',
          },
        ])
        .mockResolvedValueOnce([{}]);

      const res = await service.getExamResults('e1', {
        id: 'u1',
        role: 'TEACHER',
      });

      expect(res.results[0].status).toBe('Passed');
    });
  });
});
