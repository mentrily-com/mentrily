import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('email')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor() {
    super();
  }

  async process(job: Job<Record<string, unknown>>): Promise<void> {
    switch (job.name) {
      case 'welcome': {
        this.logger.warn(
          'Skipped legacy welcome email job: Clerk invitations handle onboarding',
        );
        return;
      }
      case 'password-reset': {
        this.logger.warn(
          'Skipped legacy password reset email job: Clerk handles password resets',
        );
        return;
      }
      default:
        this.logger.warn(`Unknown email job: ${job.name}`);
    }
  }
}
