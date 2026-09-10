import { Test, TestingModule } from '@nestjs/testing';
import { StudentAnnouncementsService } from './student-announcements.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('StudentAnnouncementsService', () => {
  let service: StudentAnnouncementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentAnnouncementsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
          },
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
});
