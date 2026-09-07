import { Test, TestingModule } from '@nestjs/testing';
import { TeacherAnnouncementsService } from './teacher-announcements.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { StorageService } from '../../services/storage/storage.service';

describe('TeacherAnnouncementsService', () => {
  let service: TeacherAnnouncementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherAnnouncementsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
        },
        { provide: NotificationGateway, useValue: { broadcastAnnouncement: jest.fn() } },
        {
          provide: StorageService,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherAnnouncementsService>(TeacherAnnouncementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
