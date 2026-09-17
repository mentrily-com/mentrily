import { Test, TestingModule } from '@nestjs/testing';
import { TeacherCoursesService } from './teacher-courses.service';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { CourseService } from '../course/course.service';
import { QuotaService } from '../billing/quota.service';

describe('TeacherCoursesService', () => {
  let service: TeacherCoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherCoursesService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
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
        { provide: CourseService, useValue: {} },
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
});
