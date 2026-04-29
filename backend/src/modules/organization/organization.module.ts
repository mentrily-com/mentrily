import { forwardRef, Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { OrgProvisioningService } from './org-provisioning.service';

@Module({
  imports: [PrismaModule, forwardRef(() => BillingModule)],
  controllers: [OrganizationController],
  providers: [OrgProvisioningService],
  exports: [OrgProvisioningService],
})
export class OrganizationModule {}
