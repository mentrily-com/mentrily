import { Test, TestingModule } from '@nestjs/testing';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { StorageService } from '../../services/storage/storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('SuperAdminController', () => {
  let controller: SuperAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuperAdminController],
      providers: [
        { provide: SuperAdminService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SuperAdminController>(SuperAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
