import { Test, TestingModule } from '@nestjs/testing';
import { TeacherCoursesService } from './teacher-courses.service';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { CourseService } from '../course/course.service';
import { QuotaService } from '../billing/quota.service';

describe('TeacherCoursesService', () => {
  let service: TeacherCoursesService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherCoursesService,
        {
          provide: SupabaseService,
          useValue: {
            client: { from: jest.fn() },
            legacyPrisma: (prisma = {}),
          },
        },
        {
          provide: TeacherService,
          useValue: {
            checkAccess: jest.fn(),
            canUseCustomSlug: jest.fn(),
            createUniqueSlug: jest.fn(),
            resolveIncomingSlug: jest.fn(),
            createCourseRecordWithRetry: jest.fn(),
            findExamByIdCompat: jest.fn(),
            assertLinkableExam: jest.fn(),
            assertLinkableCertificateTemplate: jest.fn(),
            enforceQuestionTypeAccess: jest.fn(),
          },
        },
        {
          provide: CourseService,
          useValue: { invalidateCourseCache: jest.fn() },
        },
        {
          provide: QuotaService,
          useValue: { checkQuestionTypeAllowed: jest.fn() },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherCoursesService>(TeacherCoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateCourse content sync', () => {
    const OWN_MOD = '11111111-1111-4111-8111-111111111111';
    const OWN_UNIT = '22222222-2222-4222-8222-222222222222';
    const FOREIGN_MOD = '33333333-3333-4333-8333-333333333333';
    const FOREIGN_UNIT = '44444444-4444-4444-8444-444444444444';
    const FOREIGN_TEST = '55555555-5555-4555-8555-555555555555';
    let tx: any;

    beforeEach(() => {
      tx = {
        courseModule: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: OWN_MOD,
              title: 'Old',
              order: 0,
              units: [{ id: OWN_UNIT, moduleId: OWN_MOD, content: {} }],
            },
          ]),
          deleteMany: jest.fn(),
          update: jest.fn(async ({ where }) => ({ id: where.id })),
          create: jest.fn(async () => ({ id: 'new-mod' })),
          upsert: jest.fn(),
        },
        unit: {
          deleteMany: jest.fn(),
          upsert: jest.fn(),
          create: jest.fn(),
        },
      };
      Object.assign(prisma, {
        course: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'c1',
            slug: 'c1',
            orgId: null,
            students: [],
          }),
          update: jest.fn().mockResolvedValue({ id: 'c1', slug: 'c1' }),
        },
        courseModule: { count: jest.fn() },
        $transaction: jest.fn((fn: any) => fn(tx)),
        courseTest: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(),
          upsert: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
        },
      });
    });

    it('never updates or re-parents rows whose ids belong to another course', async () => {
      await service.updateCourse(
        'c1',
        { id: 'u1' },
        {
          sections: [
            {
              id: OWN_MOD,
              title: 'Renamed',
              questions: [{ id: OWN_UNIT, title: 'U', type: 'VIDEO' }],
            },
            {
              id: FOREIGN_MOD,
              title: 'Hijack',
              questions: [{ id: FOREIGN_UNIT, title: 'X', type: 'VIDEO' }],
            },
          ],
          tests: [{ id: FOREIGN_TEST, title: 'T', slug: 't', questions: [] }],
        },
      );

      expect(tx.courseModule.update).toHaveBeenCalledTimes(1);
      expect(tx.courseModule.update.mock.calls[0][0].where.id).toBe(OWN_MOD);
      expect(tx.courseModule.upsert).not.toHaveBeenCalled();
      expect(tx.courseModule.create).toHaveBeenCalledWith({
        data: { title: 'Hijack', order: 1, courseId: 'c1' },
      });

      expect(tx.unit.upsert).toHaveBeenCalledTimes(1);
      expect(tx.unit.upsert.mock.calls[0][0].where.id).toBe(OWN_UNIT);
      const createdUnit = tx.unit.create.mock.calls[0][0].data;
      expect(createdUnit.id).toBeUndefined();
      expect(createdUnit.moduleId).toBe('new-mod');

      expect(prisma.courseTest.upsert).not.toHaveBeenCalled();
      expect(prisma.courseTest.update).not.toHaveBeenCalled();
      expect(prisma.courseTest.create.mock.calls[0][0].data.id).toBeUndefined();
    });
  });
});
