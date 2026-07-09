import { forwardRef, Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { OrgProvisioningService } from './org-provisioning.service';
import { MembershipService } from './membership.service';

@Module({
  imports: [PrismaModule, forwardRef(() => BillingModule)],
  controllers: [OrganizationController],
  providers: [OrgProvisioningService, MembershipService],
  exports: [OrgProvisioningService, MembershipService],
})
export class OrganizationModule {}
