import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { StudentService } from './student.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';
import { CertificateService } from '../certificate/certificate.service';

describe('StudentService', () => {
  let service: StudentService;
  let prisma: any;
  let redis: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: (prisma = {
              unit: { findUnique: jest.fn() },
              course: { findFirst: jest.fn() },
              unitSubmission: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn(async ({ data }) => data),
              },
              exam: { findMany: jest.fn().mockResolvedValue([]) },
            }),
          },
        },
        { provide: ExamService, useValue: { transformExam: jest.fn() } },
        {
          provide: CertificateService,
          useValue: {
            listCertificates: jest.fn(),
            getCertificateForUser: jest.fn(),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: (redis = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
          }),
        },
        {
          provide: getQueueToken('student-analytics'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getModules does not list other orgs exams for org-less learners', async () => {
    await service.getModules({ id: 'u1', orgId: null });
    const args = prisma.exam.findMany.mock.calls[0][0];
    expect(args.where.orgId).toBeNull();
    expect(args.take).toBe(100);
    expect(args.include).toBeUndefined();
  });

  describe('submitUnit', () => {
    const unit = (type: string, orgId: string | null = 'org1') => ({
      id: 'unit1',
      type,
      content: {},
      module: { course: { id: 'c1', orgId, creatorId: 'teacher' } },
    });
    const learner = { id: 'u1', orgId: 'org1', role: 'STUDENT' };

    it('rejects learners not enrolled in the unit course', async () => {
      prisma.unit.findUnique.mockResolvedValue(unit('Reading'));
      prisma.course.findFirst.mockResolvedValue(null);
      await expect(
        service.submitUnit(learner, 'unit1', {
          status: 'COMPLETED',
          content: {},
        }),
      ).rejects.toThrow('You are not enrolled in this course');
      expect(prisma.unitSubmission.create).not.toHaveBeenCalled();
    });

    it('rejects units from another org', async () => {
      prisma.unit.findUnique.mockResolvedValue(unit('Reading', 'org2'));
      await expect(
        service.submitUnit(learner, 'unit1', {
          status: 'COMPLETED',
          content: {},
        }),
      ).rejects.toThrow('You do not have access to this unit');
    });

    it('accepts client COMPLETED for non-graded units', async () => {
      prisma.unit.findUnique.mockResolvedValue(unit('Reading'));
      prisma.course.findFirst.mockResolvedValue({ id: 'c1' });
      const res = await service.submitUnit(learner, 'unit1', {
        status: 'COMPLETED',
        content: {},
        score: 100,
      });
      expect(res.status).toBe('COMPLETED');
    });

    it('downgrades a Coding COMPLETED without a server-recorded pass', async () => {
      prisma.unit.findUnique.mockResolvedValue(unit('Coding'));
      prisma.course.findFirst.mockResolvedValue({ id: 'c1' });
      redis.get.mockResolvedValue(null);
      const res = await service.submitUnit(learner, 'unit1', {
        status: 'COMPLETED',
        content: 'code',
        score: 100,
      });
      expect(redis.get).toHaveBeenCalledWith('unit-pass:u1:unit1');
      expect(res).toMatchObject({ status: 'IN_PROGRESS', score: 0 });
    });

    it('keeps Coding COMPLETED when the server recorded a pass', async () => {
      prisma.unit.findUnique.mockResolvedValue(unit('Coding'));
      prisma.course.findFirst.mockResolvedValue({ id: 'c1' });
      redis.get.mockResolvedValue('1');
      const res = await service.submitUnit(learner, 'unit1', {
        status: 'COMPLETED',
        content: 'code',
        score: 100,
      });
      expect(res.status).toBe('COMPLETED');
    });
  });
});
