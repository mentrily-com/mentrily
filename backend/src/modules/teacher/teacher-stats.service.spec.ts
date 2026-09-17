import { Test, TestingModule } from '@nestjs/testing';
import { TeacherStatsService } from './teacher-stats.service';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('TeacherStatsService', () => {
  let service: TeacherStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherStatsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
        },
        {
          provide: TeacherService,
          useValue: { checkAccess: jest.fn() },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherStatsService>(TeacherStatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
