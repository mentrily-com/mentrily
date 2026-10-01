import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { MembershipService } from '../organization/membership.service';
import { ExamService } from './exam.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('ExamService - Tenant Isolation', () => {
  let service: ExamService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockMembershipService: any;

  beforeEach(async () => {
    mockPrisma = {
      exam: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      courseTest: {
        findFirst: jest.fn(),
      },
      course: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockMembershipService = {
      isPublicOrgResource: jest.fn().mockResolvedValue(false),
      resolveActiveMembership: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CertificateService, useValue: {} },
        { provide: NotificationGateway, useValue: {} },
        { provide: MembershipService, useValue: mockMembershipService },
        ExamService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: mockPrisma,
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<ExamService>(ExamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertExamOrgAccess tenant scoping', () => {
    it('allows access when exam belongs to user organization', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
      });

      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };
      await expect(
        service.assertExamOrgAccess('exam-1', user),
      ).resolves.toBeUndefined();
    });

    it('rejects access with ForbiddenException when exam belongs to another organization', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-2',
        orgId: 'org-beta',
        creatorId: 'teacher-2',
      });

      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };
      await expect(service.assertExamOrgAccess('exam-2', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects access when user is not provided', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
      });

      await expect(service.assertExamOrgAccess('exam-1', null)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SUPER_ADMIN to access exams across any organization', async () => {
      const superAdmin = { id: 'admin-super', role: 'SUPER_ADMIN' };
      await expect(
        service.assertExamOrgAccess('exam-any', superAdmin),
      ).resolves.toBeUndefined();
    });
  });

  describe('getExamBySlug cross-tenant protection', () => {
    it('rejects cross-tenant exam retrieval with NotFoundException', async () => {
      const mockExam = {
        id: 'exam-cross',
        slug: 'secure-final',
        orgId: 'org-beta',
        creatorId: 'teacher-beta',
        isActive: true,
        questions: [],
      };
      mockPrisma.exam.findFirst.mockResolvedValue(mockExam);
      mockMembershipService.isPublicOrgResource.mockResolvedValue(false);

      const user = { id: 'student-alpha', role: 'STUDENT', orgId: 'org-alpha' };

      await expect(
        service.getExamBySlug('secure-final', user, 'org-alpha'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects creator accessing exam under another org context', async () => {
      const mockExam = {
        id: 'exam-own',
        slug: 'creator-final',
        orgId: 'org-beta',
        creatorId: 'user-1',
        isActive: true,
        questions: [],
      };
      mockPrisma.exam.findFirst.mockResolvedValue(mockExam);
      mockMembershipService.isPublicOrgResource.mockResolvedValue(false);

      // User created it under org-beta, but active org context is org-alpha
      const user = { id: 'user-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(
        service.getExamBySlug('creator-final', user, 'org-alpha'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createExam tenant attribution', () => {
    it('attaches creatorId and orgId to created exam', async () => {
      mockPrisma.exam.create.mockResolvedValue({
        id: 'exam-new',
        slug: 'new-quiz',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
      });

      const user = { id: 'teacher-1', orgId: 'org-alpha' };
      const dto = { title: 'New Quiz', slug: 'new-quiz', questions: [] };

      const created = await service.createExam(dto, user);
      expect(mockPrisma.exam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creatorId: 'teacher-1',
            orgId: 'org-alpha',
          }),
        }),
      );
      expect(created.id).toBe('exam-new');
    });
  });
});
