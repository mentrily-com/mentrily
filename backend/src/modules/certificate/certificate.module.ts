import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { StorageModule } from '../../services/storage/storage.module';
import { SupabaseModule } from '../../services/supabase/supabase.module';
import { CertificateController } from './certificate.controller';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [SupabaseModule, StorageModule, OrganizationModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
