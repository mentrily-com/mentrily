import { Test, TestingModule } from '@nestjs/testing';
import { SuperAdminService } from './super-admin.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { StorageService } from '../../services/storage/storage.service';
import { BillingService } from '../billing/billing.service';
import { QuotaService } from '../billing/quota.service';

describe('SuperAdminService', () => {
  let service: SuperAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: {},
          },
        },
        { provide: StorageService, useValue: {} },
        { provide: BillingService, useValue: {} },
        { provide: QuotaService, useValue: {} },
      ],
    }).compile();

    service = module.get<SuperAdminService>(SuperAdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
