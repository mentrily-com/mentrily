import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigModule } from '@nestjs/config';
import { BillingModule } from '../../modules/billing/billing.module';
import { PrismaModule } from '../../services/prisma/prisma.module';

@Module({
  imports: [ConfigModule, BillingModule, PrismaModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
