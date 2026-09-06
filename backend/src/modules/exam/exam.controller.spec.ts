import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

describe('ExamController', () => {
  let controller: ExamController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamController],
      providers: [
        { provide: ExamService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ExamController>(ExamController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
