import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { MailService } from '../../services/mail.service';
import { StorageService } from '../../services/storage/storage.service';
import { QuotaService } from '../billing/quota.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';
import { MembershipService } from '../organization/membership.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn() },
            legacyPrisma: {},
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { scheduleCreatorOnboardingSequence: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: { deleteFile: jest.fn(), uploadFile: jest.fn() },
        },
        { provide: QuotaService, useValue: { recalculateCounters: jest.fn() } },
        {
          provide: OrgProvisioningService,
          useValue: { provisionOrganization: jest.fn() },
        },
        {
          provide: MembershipService,
          useValue: { ensureMembership: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
