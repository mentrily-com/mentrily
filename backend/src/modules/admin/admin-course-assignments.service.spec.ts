import { Test, TestingModule } from '@nestjs/testing';
import { AdminCourseAssignmentsService } from './admin-course-assignments.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('AdminCourseAssignmentsService', () => {
  let service: AdminCourseAssignmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCourseAssignmentsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jest.fn() }, legacyPrisma: {} },
        },
      ],
    }).compile();

    service = module.get<AdminCourseAssignmentsService>(
      AdminCourseAssignmentsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
