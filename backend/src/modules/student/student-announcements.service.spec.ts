import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StudentAnnouncementsService } from './student-announcements.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('StudentAnnouncementsService - Tenant Isolation', () => {
  let service: StudentAnnouncementsService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      announcement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      announcementRead: {
        upsert: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(2),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentAnnouncementsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: mockPrisma },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<StudentAnnouncementsService>(
      StudentAnnouncementsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAnnouncements tenant scoping', () => {
    it('scopes announcement query with orgId when provided', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([]);

      await service.getAnnouncements('student-1', { orgId: 'org-alpha' });

      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-alpha',
          }),
        }),
      );
    });
  });

  describe('getUnreadAnnouncementCount tenant scoping', () => {
    it('scopes unread count query with orgId when provided', async () => {
      mockPrisma.announcement.count.mockResolvedValue(3);

      const result = await service.getUnreadAnnouncementCount(
        'student-1',
        'org-alpha',
      );

      expect(mockPrisma.announcement.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-alpha',
          }),
        }),
      );
      expect(result.count).toBe(3);
    });
  });

  describe('markAnnouncementRead tenant isolation', () => {
    it('rejects with NotFoundException if announcement belongs to another org', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-beta',
        orgId: 'org-beta',
      });

      await expect(
        service.markAnnouncementRead('student-1', 'ann-beta', 'org-alpha'),
      ).rejects.toThrow(NotFoundException);
    });

    it('marks announcement as read when orgId matches', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-alpha',
        orgId: 'org-alpha',
      });
      mockPrisma.announcementRead.upsert.mockResolvedValue({
        userId: 'student-1',
        announcementId: 'ann-alpha',
      });

      const result = await service.markAnnouncementRead(
        'student-1',
        'ann-alpha',
        'org-alpha',
      );

      expect(mockPrisma.announcementRead.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_announcementId: {
              userId: 'student-1',
              announcementId: 'ann-alpha',
            },
          },
        }),
      );
      expect(result.announcementId).toBe('ann-alpha');
    });
  });
});
