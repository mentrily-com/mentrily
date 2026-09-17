import { Test, TestingModule } from '@nestjs/testing';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { MembershipService } from '../organization/membership.service';
import { ExamService } from './exam.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('ExamService', () => {
  let service: ExamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CertificateService, useValue: {} },
        { provide: NotificationGateway, useValue: {} },
        { provide: MembershipService, useValue: {} },
        ExamService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: {},
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ExamService>(ExamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
