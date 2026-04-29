import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigModule } from '@nestjs/config';
import { BillingModule } from '../../modules/billing/billing.module';

@Module({
  imports: [ConfigModule, BillingModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
