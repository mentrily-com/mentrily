import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TeacherAnnouncementsService } from './teacher-announcements.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { StorageService } from '../../services/storage/storage.service';

describe('TeacherAnnouncementsService - Tenant Isolation', () => {
  let service: TeacherAnnouncementsService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      announcement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      studentGroup: {
        findMany: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherAnnouncementsService,
        {
          provide: SupabaseService,
          useValue: {
            client: { from: jest.fn() },
            legacyPrisma: mockPrisma,
          },
        },
        {
          provide: NotificationGateway,
          useValue: { broadcastAnnouncement: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
            isOwnedByNamespace: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<TeacherAnnouncementsService>(
      TeacherAnnouncementsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAnnouncements tenant scoping', () => {
    it('scopes query to orgId and teacherId for standard teacher in an org', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([]);
      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await service.getAnnouncements(user);

      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teacherId: 'teacher-1',
            orgId: 'org-alpha',
          }),
        }),
      );
    });

    it('scopes query to orgId for organization admin', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([]);
      const admin = { id: 'admin-1', role: 'ADMIN', orgId: 'org-alpha' };

      await service.getAnnouncements(admin);

      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-alpha',
          }),
        }),
      );
    });
  });

  describe('updateAnnouncement & deleteAnnouncement cross-tenant protection', () => {
    it('rejects updateAnnouncement with ForbiddenException when announcement belongs to another org', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        title: 'Org Beta Announcement',
        teacherId: 'teacher-2',
        orgId: 'org-beta',
        groups: [{ id: 'g1' }],
      });

      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(
        service.updateAnnouncement('ann-1', user, {
          title: 'Hacked',
          content: 'Hacked content',
          groupIds: ['g1'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects deleteAnnouncement with ForbiddenException when announcement belongs to another org', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-2',
        title: 'Org Beta Notice',
        teacherId: 'teacher-2',
        orgId: 'org-beta',
        groups: [],
        attachments: [],
      });

      const user = { id: 'admin-alpha', role: 'ADMIN', orgId: 'org-alpha' };

      await expect(service.deleteAnnouncement('ann-2', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects cross-tenant access even if caller is teacherId when acting under different org context', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-3',
        title: 'Teacher Past Announcement',
        teacherId: 'teacher-1',
        orgId: 'org-beta',
        groups: [],
        attachments: [],
      });

      // User created it under org-beta, but is currently scoped to org-alpha
      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(service.deleteAnnouncement('ann-3', user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
