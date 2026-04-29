import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

type ExamInviteJob = {
  recipient: { email: string; name: string };
  customMessage?: string;
  exam: {
    id: string;
    title: string;
    slug: string;
    duration: number;
    testCode?: string | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
  };
  organization: {
    name: string;
    primaryColor?: string;
    logo?: string;
    domain?: string;
  };
};

@Processor('exam-invite-email', {
  limiter: {
    max: 10,
    duration: 1000,
  },
})
export class ExamInviteProcessor extends WorkerHost {
  private readonly logger = new Logger(ExamInviteProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<ExamInviteJob>): Promise<void> {
    if (job.name !== 'exam-invite') {
      this.logger.warn(`Unknown exam invite job: ${job.name}`);
      return;
    }

    await this.mailService.sendExamInviteEmail(
      job.data.recipient,
      job.data.exam,
      job.data.organization,
      job.data.customMessage,
    );
  }
}
