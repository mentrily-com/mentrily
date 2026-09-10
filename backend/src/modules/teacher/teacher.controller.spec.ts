import { Test, TestingModule } from '@nestjs/testing';
import { TeacherController } from './teacher.controller';
import { TeacherGroupsService } from './teacher-groups.service';
import { TeacherAnnouncementsService } from './teacher-announcements.service';
import { TeacherStudentsService } from './teacher-students.service';
import { TeacherStatsService } from './teacher-stats.service';
import { TeacherCoursesService } from './teacher-courses.service';
import { TeacherExamsService } from './teacher-exams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgStatusGuard } from '../auth/guards/org-status.guard';
import { OrgFeaturesGuard } from '../auth/guards/org-features.guard';

describe('TeacherController', () => {
  let controller: TeacherController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherController],
      providers: [
        { provide: TeacherGroupsService, useValue: {} },
        { provide: TeacherAnnouncementsService, useValue: {} },
        { provide: TeacherStudentsService, useValue: {} },
        { provide: TeacherStatsService, useValue: {} },
        { provide: TeacherCoursesService, useValue: {} },
        { provide: TeacherExamsService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(OrgStatusGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(OrgFeaturesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<TeacherController>(TeacherController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
