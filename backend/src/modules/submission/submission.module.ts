import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionService } from './submission.service';
import { SubmissionProcessor } from './submission.processor';
import { SubmissionController } from './submission.controller';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CertificateModule } from '../certificate/certificate.module';
import { WebhookModule } from '../webhook/webhook.module';
import { ExamModule } from '../exam/exam.module';

@Module({
  imports: [
    PrismaModule,
    CertificateModule,
    WebhookModule,
    ExamModule,
    BullModule.registerQueue(
      { name: 'submission_queue' },
      { name: 'student-analytics' },
    ),
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService, SubmissionProcessor],
  exports: [SubmissionService],
})
export class SubmissionModule {}
