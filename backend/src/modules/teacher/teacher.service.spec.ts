import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MembershipService } from '../organization/membership.service';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { QuotaService } from '../billing/quota.service';

describe('TeacherService - Tenant Isolation', () => {
  let service: TeacherService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      courseAssignment: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: MembershipService, useValue: {} },
        TeacherService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: mockPrisma,
          },
        },
        {
          provide: QuotaService,
          useValue: { ensureFeatureEnabled: jest.fn() },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAccess tenant isolation', () => {
    it('allows access when user is SUPER_ADMIN', async () => {
      const resource = {
        id: 'course-1',
        orgId: 'org-beta',
        creatorId: 'user-2',
      };
      const superAdmin = { id: 'admin-super', role: 'SUPER_ADMIN' };

      await expect(service.checkAccess(resource, superAdmin)).resolves.toBe(
        true,
      );
    });

    it('allows access when user is ADMIN in the same organization', async () => {
      const resource = {
        id: 'course-1',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
      };
      const admin = { id: 'admin-1', role: 'ADMIN', orgId: 'org-alpha' };

      await expect(service.checkAccess(resource, admin)).resolves.toBe(true);
    });

    it('rejects access with ForbiddenException when resource belongs to a different organization', async () => {
      const resource = {
        id: 'course-1',
        orgId: 'org-beta',
        creatorId: 'teacher-2',
      };
      const teacher = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(service.checkAccess(resource, teacher)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects cross-tenant access even if caller is creator when acting in another org', async () => {
      const resource = {
        id: 'course-1',
        orgId: 'org-beta',
        creatorId: 'teacher-1',
      };
      // Teacher created course in org-beta, but active org context is org-alpha
      const teacher = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(service.checkAccess(resource, teacher)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects access when user is null', async () => {
      const resource = {
        id: 'course-1',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
      };

      await expect(service.checkAccess(resource, null)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
