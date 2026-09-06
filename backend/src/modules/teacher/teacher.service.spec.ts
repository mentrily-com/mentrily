import { Test, TestingModule } from '@nestjs/testing';
import { MembershipService } from '../organization/membership.service';
import { getQueueToken } from '@nestjs/bullmq';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { MonitoringGateway } from '../monitoring/monitoring.gateway';
import { NotificationGateway } from '../notification/notification.gateway';
import { StorageService } from '../../services/storage/storage.service';
import { ExamService } from '../exam/exam.service';
import { CourseService } from '../course/course.service';
import { QuotaService } from '../billing/quota.service';
import { WebhookService } from '../webhook/webhook.service';

describe('TeacherService', () => {
  let service: TeacherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: MembershipService, useValue: {} },
        TeacherService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: {},
          },
        },
        { provide: MonitoringGateway, useValue: {} },
        { provide: NotificationGateway, useValue: {} },
        {
          provide: StorageService,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
        { provide: ExamService, useValue: { transformExam: jest.fn() } },
        { provide: CourseService, useValue: {} },
        {
          provide: QuotaService,
          useValue: { ensureFeatureEnabled: jest.fn() },
        },
        { provide: WebhookService, useValue: { dispatch: jest.fn() } },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: getQueueToken('exam-invite-email'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
