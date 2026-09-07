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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherExamsService,
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
        { provide: MonitoringGateway, useValue: {} },
        { provide: ExamService, useValue: { transformExam: jest.fn() } },
        {
          provide: QuotaService,
          useValue: { checkQuestionTypeAllowed: jest.fn() },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: getQueueToken('exam-invite-email'),
          useValue: { add: jest.fn(), addBulk: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherExamsService>(TeacherExamsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
