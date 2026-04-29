import { Test, TestingModule } from '@nestjs/testing';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgStatusGuard } from '../auth/guards/org-status.guard';
import { OrgFeaturesGuard } from '../auth/guards/org-features.guard';

describe('TeacherController', () => {
  let controller: TeacherController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeacherController],
      providers: [{ provide: TeacherService, useValue: {} }],
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
