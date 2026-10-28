import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { MembershipService } from '../organization/membership.service';
import { ExamService } from './exam.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('ExamService - exam integrity', () => {
  let service: ExamService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockMembershipService: any;

  beforeEach(async () => {
    mockPrisma = {
      exam: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      courseTest: {
        findFirst: jest.fn(),
      },
      course: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockMembershipService = {
      isPublicOrgResource: jest.fn().mockResolvedValue(false),
      resolveActiveMembership: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CertificateService, useValue: {} },
        { provide: NotificationGateway, useValue: {} },
        { provide: MembershipService, useValue: mockMembershipService },
        ExamService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: mockPrisma,
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<ExamService>(ExamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateScoreDetails coding integrity', () => {
    const questions = [{ id: 'c1', type: 'CODING', marks: 10 }];

    it('ignores client-supplied testResults (forged => 0 marks)', () => {
      const result = service.calculateScoreDetails(
        {
          c1: {
            code: 'x',
            testResults: [{ passed: true }, { passed: true }],
            results: [{ passed: true }],
          },
        },
        questions,
      );
      expect(result.marksByQuestion.c1).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('scores proportionally from the server coding record', () => {
      const result = service.calculateScoreDetails(
        { c1: { code: 'x' }, '_internal_coding:c1': { passed: 3, total: 4 } },
        questions,
      );
      expect(result.marksByQuestion.c1).toBe(7.5);
      expect(result.percentage).toBe(75);
    });

    it('rejects an impossible record', () => {
      const result = service.calculateScoreDetails(
        { '_internal_coding:c1': { passed: 9, total: 4 } },
        questions,
      );
      expect(result.marksByQuestion.c1).toBe(0);
    });
  });

  describe('getExamGradingData / filterAnswersForExam', () => {
    it('re-reads questions once before dropping a stale-memo answer', async () => {
      mockPrisma.exam.findUnique
        .mockResolvedValueOnce({ questions: [{ id: 'q1' }], duration: 60 })
        .mockResolvedValueOnce({
          questions: [{ id: 'q1' }, { id: 'q2' }],
          duration: 60,
        });
      await service.getExamGradingData('e1');
      // Age the memo past the 5s refetch floor.
      (service as any).gradingMemo.get('e1').fetchedAt -= 10_000;

      const { accepted } = await service.filterAnswersForExam(
        'e1',
        { q1: 'a', q2: 'b' },
        {},
      );
      expect(accepted).toEqual({ q1: 'a', q2: 'b' });
      expect(mockPrisma.exam.findUnique).toHaveBeenCalledTimes(2);
    });

    it('shares one query between concurrent misses', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ questions: [] });
      await Promise.all([
        service.getExamGradingData('e2'),
        service.getExamGradingData('e2'),
      ]);
      expect(mockPrisma.exam.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('assertExamWindowOpen', () => {
    const student = { id: 's1', role: 'STUDENT', orgId: 'o1' };
    beforeEach(() => {
      mockPrisma.examSession = { count: jest.fn().mockResolvedValue(0) };
    });

    it('rejects entry before the window opens', async () => {
      await expect(
        service.assertExamWindowOpen(
          { id: 'e', startTime: new Date(Date.now() + 60_000), endTime: null },
          student,
        ),
      ).rejects.toThrow('EXAM_NOT_STARTED');
    });

    it('rejects a fresh entry after the window closes', async () => {
      await expect(
        service.assertExamWindowOpen(
          { id: 'e', startTime: null, endTime: new Date(Date.now() - 1000) },
          student,
        ),
      ).rejects.toThrow('EXAM_ENDED');
    });

    it('still lets an in-progress session resume after endTime', async () => {
      mockPrisma.examSession.count.mockResolvedValue(1);
      await expect(
        service.assertExamWindowOpen(
          {
            id: 'e',
            linkedCourseId: 'c',
            startTime: null,
            endTime: new Date(Date.now() - 1000),
          },
          student,
        ),
      ).resolves.toBeUndefined();
      expect(mockPrisma.examSession.count).toHaveBeenCalledWith({
        where: { userId: 's1', examId: 'e', status: 'IN_PROGRESS' },
      });
    });
  });

  describe('getExamBySlug question gating', () => {
    const exam = {
      id: 'exam-g',
      slug: 'gated',
      orgId: 'org-alpha',
      creatorId: 'teacher-1',
      isActive: true,
      testCode: 'ABC123',
      startTime: null,
      questions: [{ id: 'q1', type: 'MCQ', title: 'Q1' }],
    };
    const student = { id: 'student-1', role: 'STUDENT', orgId: 'org-alpha' };

    beforeEach(() => {
      mockPrisma.exam.findFirst.mockResolvedValue(exam);
      mockPrisma.examSession = { count: jest.fn().mockResolvedValue(0) };
    });

    it('withholds questions without a test-code grant or session', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(0);
      const result = await service.getExamBySlug('gated', student);
      expect(result.questionsLocked).toBe(true);
      expect(result.questions).toEqual({});
      expect(result.id).toBe('exam-g');
    });

    it('returns questions once the test code was accepted', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(1);
      const result = await service.getExamBySlug('gated', student);
      expect(result.questionsLocked).toBeUndefined();
      expect(Object.keys(result.questions)).toContain('q1');
    });
  });
});
