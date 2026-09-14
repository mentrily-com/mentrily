import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { AiController } from './ai.controller';
import { AiCreditsModule } from './credits/ai-credits.module';
import { OmniRouteService } from './engine/omniroute.service';
import { ContentContextService } from './context/content-context.service';
import { CodingVerifierService } from './quality/coding-verifier.service';
import { GenerationService } from './generation/generation.service';
import { QuestionOpsService } from './generation/question-ops.service';
import { AI_GENERATION_QUEUE, AiJobsService } from './jobs/ai-jobs.service';
import { AiGenerationProcessor } from './jobs/ai-generation.processor';
import { ConversationService } from './chat/conversation.service';
import { AiChatService } from './chat/ai-chat.service';

@Module({
  imports: [
    PrismaModule,
    CodeExecutionModule,
    AiCreditsModule,
    BullModule.registerQueue({ name: AI_GENERATION_QUEUE }),
  ],
  controllers: [AiController],
  providers: [
    OmniRouteService,
    ContentContextService,
    CodingVerifierService,
    GenerationService,
    QuestionOpsService,
    AiJobsService,
    AiGenerationProcessor,
    ConversationService,
    AiChatService,
  ],
})
export class AiModule {}
