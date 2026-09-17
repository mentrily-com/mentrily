import { Test, TestingModule } from '@nestjs/testing';
import { TeacherStudentsService } from './teacher-students.service';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';
import { WebhookService } from '../webhook/webhook.service';

describe('TeacherStudentsService', () => {
  let service: TeacherStudentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherStudentsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
        },
        {
          provide: TeacherService,
          useValue: {
            checkAccess: jest.fn(),
            getBlockedEnrollments: jest.fn(),
          },
        },
        { provide: ExamService, useValue: { transformExam: jest.fn() } },
        { provide: WebhookService, useValue: { dispatch: jest.fn() } },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherStudentsService>(TeacherStudentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
