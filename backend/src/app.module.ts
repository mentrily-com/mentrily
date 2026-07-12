import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { SupabaseModule } from './services/supabase/supabase.module';
import { ExamModule } from './modules/exam/exam.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StudentModule } from './modules/student/student.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { AdminModule } from './modules/admin/admin.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { CourseModule } from './modules/course/course.module';

import { CodeExecutionModule } from './modules/code-execution/code-execution.module';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from './modules/ai/ai.module';
import { NotificationModule } from './modules/notification/notification.module';
import { BillingModule } from './modules/billing/billing.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS || 60000),
        limit: Number(process.env.THROTTLE_LIMIT || 300),
      },
    ]),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL');
        if (redisUrl) {
          return {
            type: 'single',
            url: redisUrl,
          };
        }
        return {
          type: 'single',
          url: `redis://${config.get('REDIS_HOST') || 'localhost'}:${config.get('REDIS_PORT') || 6379}`,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL');
        let connection: any = {
          host: config.get('REDIS_HOST') || 'localhost',
          port: config.get('REDIS_PORT') || 6379,
        };

        if (redisUrl) {
          const url = new URL(redisUrl);
          connection = {
            host: url.hostname,
            port: Number(url.port),
            username: url.username,
            password: url.password,
            tls:
              url.protocol === 'rediss:'
                ? { rejectUnauthorized: false }
                : undefined,
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false,
            family: 4, // Force IPv4 to avoid dual-stack DNS lookups
          };
        } else {
          connection.maxRetriesPerRequest = null;
          connection.enableReadyCheck = false;
          connection.family = 4;
        }

        return {
          connection,
          defaultJobOptions: {
            removeOnComplete: 10, // Keep only last 10 jobs to save storage
            removeOnFail: 50, // Keep last 50 failed jobs for debugging
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    SupabaseModule,
    ExamModule,
    MonitoringModule,
    SubmissionModule,
    TeacherModule,
    AdminModule,
    SuperAdminModule,
    CourseModule,
    StudentModule,
    OrganizationModule,
    BillingModule,
    WebhookModule,
    CodeExecutionModule,
    AiModule,
    NotificationModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
