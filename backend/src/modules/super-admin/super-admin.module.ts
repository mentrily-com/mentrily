import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { StorageModule } from '../../services/storage/storage.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, StorageModule, BillingModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
