import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { QuotaService } from './quota.service';
import { AlertService } from './alert.service';
import { MailModule } from '../../services/mail.module';
import { OrganizationModule } from '../organization/organization.module';
import { AiCreditsModule } from '../ai/credits/ai-credits.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AiCreditsModule,
    forwardRef(() => OrganizationModule),
  ],
  controllers: [BillingController],
  providers: [BillingService, QuotaService, AlertService],
  exports: [BillingService, QuotaService],
})
export class BillingModule {}
