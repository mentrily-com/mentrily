import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../services/prisma/prisma.module';
import { AiPlanService } from './ai-plan.service';
import { AiCreditsService } from './ai-credits.service';

@Module({
  imports: [PrismaModule],
  providers: [AiPlanService, AiCreditsService],
  exports: [AiPlanService, AiCreditsService],
})
export class AiCreditsModule {}
