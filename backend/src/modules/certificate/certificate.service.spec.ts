import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificateService } from './certificate.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { StorageService } from '../../services/storage/storage.service';

describe('CertificateService - Tenant Isolation', () => {
  let service: CertificateService;
  let mockPrisma: any;
  let mockStorageService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockPrisma = {
      certificateTemplate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      certificate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      course: {
        findUnique: jest.fn(),
      },
      examSession: {
        findUnique: jest.fn(),
      },
    };

    mockStorageService = {
      uploadFile: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('https://app.mentrily.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn() },
            legacyPrisma: mockPrisma,
          },
        },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTemplates & getTemplate tenant scoping', () => {
    it('scopes listTemplates to specific orgId', async () => {
      mockPrisma.certificateTemplate.findMany.mockResolvedValue([]);

      await service.listTemplates('org-alpha');

      expect(mockPrisma.certificateTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-alpha' },
        }),
      );
    });

    it('scopes getTemplate to orgId and rejects cross-tenant templates with NotFoundException', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.getTemplate('org-alpha', 'template-from-beta'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.certificateTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'template-from-beta', orgId: 'org-alpha' },
        }),
      );
    });
  });

  describe('updateTemplate & deleteTemplate tenant scoping', () => {
    it('rejects updateTemplate when template belongs to another org', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTemplate('org-alpha', 'template-beta', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects deleteTemplate when template belongs to another org', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteTemplate('org-alpha', 'template-beta'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateCertificate tenant isolation', () => {
    it('rejects course certificate generation if course belongs to different org', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        orgId: 'org-alpha',
        organization: { status: 'active', name: 'Alpha Org' },
      });
      mockPrisma.course.findUnique.mockResolvedValue({
        id: 'course-beta',
        orgId: 'org-beta', // Mismatched org
        title: 'Beta Course',
      });

      await expect(
        service.generateCertificate('student-1', 'course', 'course-beta'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects exam certificate generation if exam session belongs to different org', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        orgId: 'org-alpha',
        organization: { status: 'active', name: 'Alpha Org' },
      });
      mockPrisma.examSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'student-1',
        score: 95,
        exam: {
          id: 'exam-beta',
          orgId: 'org-beta', // Mismatched org
          title: 'Beta Exam',
        },
      });

      await expect(
        service.generateCertificate('student-1', 'exam', 'session-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listCertificates & getCertificateForUser tenant scoping', () => {
    it('scopes listCertificates with orgId', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([]);

      await service.listCertificates('student-1', 'org-alpha');

      expect(mockPrisma.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'student-1',
            orgId: 'org-alpha',
          },
        }),
      );
    });

    it('rejects getCertificateForUser with NotFoundException when certificate belongs to another org', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue({
        id: 'cert-1',
        userId: 'student-1',
        orgId: 'org-beta',
      });

      await expect(
        service.getCertificateForUser('student-1', 'cert-1', 'org-alpha'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
