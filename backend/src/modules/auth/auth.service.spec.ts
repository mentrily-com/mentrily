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
  let redis: any;
  let db: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn() },
            legacyPrisma: (db = { exam: { findFirst: jest.fn() } }),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: (redis = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            mget: jest.fn().mockResolvedValue([null, null]),
            multi: jest.fn(),
          }),
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

  describe('verifyExamTestCode lockout', () => {
    let pipeline: any;
    beforeEach(() => {
      pipeline = { incr: jest.fn(), set: jest.fn(), exec: jest.fn() };
      pipeline.incr.mockReturnValue(pipeline);
      pipeline.set.mockReturnValue(pipeline);
      redis.multi.mockReturnValue(pipeline);
    });

    it('returns 429 TOO_MANY_ATTEMPTS once the per-IP limit is reached', async () => {
      redis.mget.mockResolvedValue(['10', '10']);
      await expect(
        service.verifyExamTestCode('000000', 'exam-a', '1.2.3.4'),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: 'TOO_MANY_ATTEMPTS' },
      });
      expect(db.exam.findFirst).not.toHaveBeenCalled();
    });

    it('locks the slug for every IP after 100 failures', async () => {
      redis.mget.mockResolvedValue([null, '100']);
      await expect(
        service.verifyExamTestCode('000000', 'exam-a', '5.6.7.8'),
      ).rejects.toMatchObject({ status: 429 });
    });

    it('counts failures per slug+IP and per slug', async () => {
      db.exam.findFirst.mockResolvedValue(null);
      await expect(
        service.verifyExamTestCode('000000', 'exam-a', '1.2.3.4'),
      ).rejects.toMatchObject({ status: 401 });
      expect(pipeline.incr).toHaveBeenCalledWith(
        'exam-code-fail:ip:exam-a:1.2.3.4',
      );
      expect(pipeline.incr).toHaveBeenCalledWith('exam-code-fail:slug:exam-a');
      expect(pipeline.set).toHaveBeenCalledWith(
        'exam-code-fail:slug:exam-a',
        0,
        'EX',
        900,
        'NX',
      );
    });

    it('resets the IP counter on success', async () => {
      db.exam.findFirst.mockResolvedValue({
        id: 'e1',
        slug: 'exam-a',
        title: 'A',
        isActive: true,
      });
      await service.verifyExamTestCode('123456', 'exam-a', '1.2.3.4');
      expect(redis.del).toHaveBeenCalledWith(
        'exam-code-fail:ip:exam-a:1.2.3.4',
      );
    });
  });
});
