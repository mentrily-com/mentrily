import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { ExamInviteProcessor } from './exam-invite.processor';
import { OnboardingEmailProcessor } from './onboarding-email.processor';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      {
        name: 'email',
      },
      {
        name: 'exam-invite-email',
      },
      {
        name: 'onboarding-emails',
      },
    ),
  ],
  providers: [
    MailService,
    MailProcessor,
    ExamInviteProcessor,
    OnboardingEmailProcessor,
  ],
  exports: [MailService],
})
export class MailModule {}
