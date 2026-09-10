import { Test, TestingModule } from '@nestjs/testing';
import { TeacherGroupsService } from './teacher-groups.service';
import { TeacherService } from './teacher.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('TeacherGroupsService', () => {
  let service: TeacherGroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherGroupsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
        },
        {
          provide: TeacherService,
          useValue: {
            checkAccess: jest.fn(),
            getBlockedEnrollments: jest.fn(),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TeacherGroupsService>(TeacherGroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
