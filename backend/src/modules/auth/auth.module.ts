import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { ClerkAuthGuard } from './jwt.strategy';
import { OrgFeaturesGuard } from './guards/org-features.guard';
import { OrgStatusGuard } from './guards/org-status.guard';
import { PlanGuard } from './guards/plan.guard';
import { OrgRequiredGuard } from './guards/org-required.guard';
import { StorageModule } from '../../services/storage/storage.module';
import { MailModule } from '../../services/mail.module';
import { BillingModule } from '../billing/billing.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    MailModule,
    BillingModule,
    OrganizationModule,
    // Requires CLERK_SECRET_KEY env variable for Clerk token verification.
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ClerkAuthGuard,
    OrgFeaturesGuard,
    OrgStatusGuard,
    PlanGuard,
    OrgRequiredGuard,
  ],
  exports: [
    AuthService,
    OrgFeaturesGuard,
    OrgStatusGuard,
    PlanGuard,
    OrgRequiredGuard,
  ],
})
export class AuthModule {}
