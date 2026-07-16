import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ExamModule } from '../exam/exam.module';
import { CourseModule } from '../course/course.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../../services/storage/storage.module';
import { BullModule } from '@nestjs/bullmq';
import { BillingModule } from '../billing/billing.module';
import { WebhookModule } from '../webhook/webhook.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    PrismaModule,
    MonitoringModule,
    ExamModule,
    CourseModule,
    NotificationModule,
    StorageModule,
    BillingModule,
    WebhookModule,
    OrganizationModule,
    BullModule.registerQueue({
      name: 'exam-invite-email',
    }),
  ],
  controllers: [TeacherController],
  providers: [TeacherService],
})
export class TeacherModule {}
