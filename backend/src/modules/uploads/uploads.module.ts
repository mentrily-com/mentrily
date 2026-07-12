import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { StorageModule } from '../../services/storage/storage.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [StorageModule, BillingModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
