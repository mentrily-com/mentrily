import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SupabaseService } from './supabase/supabase.service';
import { MailService } from './mail.service';

type OnboardingStage = 'day0' | 'day3' | 'day7' | 'day14';

type OnboardingEmailJob = {
  orgId: string;
  stage: OnboardingStage;
};

@Injectable()
@Processor('onboarding-emails')
export class OnboardingEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(OnboardingEmailProcessor.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super();
  }

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private getDedupeKey(orgId: string, stage: OnboardingStage): string {
    return `onboarding-email:sent:${orgId}:${stage}`;
  }

  async process(job: Job<OnboardingEmailJob>): Promise<void> {
    if (job.name !== 'send-onboarding-email') {
      this.logger.warn(`Unknown onboarding email job: ${job.name}`);
      return;
    }

    const orgId = String(job.data?.orgId || '').trim();
    const stage = job.data?.stage;

    if (!orgId || !stage) {
      this.logger.warn('Onboarding email job skipped: missing orgId or stage');
      return;
    }

    const dedupeKey = this.getDedupeKey(orgId, stage);
    const lockResult = await this.redis.set(
      dedupeKey,
      '1',
      'EX',
      60 * 60 * 24 * 180,
      'NX',
    );
    if (!lockResult) {
      this.logger.log(
        `Onboarding email already sent (skipped): org=${orgId}, stage=${stage}`,
      );
      return;
    }

    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          status: true,
          domain: true,
          primaryColor: true,
          logo: true,
          plan: true,
          studentCount: true,
          courseCount: true,
          billingEmail: true,
          users: {
            where: { role: 'ADMIN', isActive: true },
            select: { email: true, name: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          exams: {
            select: { id: true, isActive: true },
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!organization) {
        this.logger.warn(`Onboarding email skipped: org not found (${orgId})`);
        return;
      }

      if (String(organization.status || '').toLowerCase() !== 'active') {
        this.logger.log(`Onboarding email skipped: org not active (${orgId})`);
        return;
      }

      const adminUser = organization.users?.[0];
      const toEmail = String(
        organization.billingEmail || adminUser?.email || '',
      ).trim();
      if (!toEmail) {
        this.logger.warn(
          `Onboarding email skipped: no recipient email for org ${orgId}`,
        );
        return;
      }

      const hasCourse = Number(organization.courseCount || 0) > 0;
      const hasExam =
        Array.isArray(organization.exams) && organization.exams.length > 0;
      const hasActiveExam = Array.isArray(organization.exams)
        ? organization.exams.some((exam) => Boolean(exam?.isActive))
        : false;

      await this.mailService.sendCreatorOnboardingEmail({
        stage,
        recipient: {
          email: toEmail,
          name: String(adminUser?.name || organization.name || 'Admin').trim(),
        },
        organization: {
          id: organization.id,
          name: organization.name,
          domain: organization.domain || undefined,
          primaryColor: organization.primaryColor || undefined,
          logo: organization.logo || undefined,
          plan: String(organization.plan || 'FREE'),
          studentCount: Number(organization.studentCount || 0),
          courseCount: Number(organization.courseCount || 0),
          hasCourse,
          hasExam,
          hasActiveExam,
        },
      });
    } catch (error: any) {
      await this.redis.del(dedupeKey);
      throw error;
    }
  }
}
