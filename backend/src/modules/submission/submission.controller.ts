import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/user.decorator';

@Controller('submission')
@UseGuards(JwtAuthGuard)
export class SubmissionController {
  constructor(private submissionService: SubmissionService) {}

  @Post('save-answer')
  async saveAnswer(
    @Body() body: { sessionId: string; sectionId: string; answer: any },
    @User() user: any,
  ) {
    await this.submissionService.assertSessionOwnership(
      body.sessionId,
      user?.id,
    );
    await this.submissionService.queueAnswer(body.sessionId, body.answer);
    return { status: 'queued' };
  }

  @Post('section')
  async submitSection(
    @Body() body: { sessionId: string; sectionId: string; answers: any },
    @User() user: any,
  ) {
    await this.submissionService.assertSessionOwnership(
      body.sessionId,
      user?.id,
    );

    // Persist answers PLUS a marker that the section is submitted
    const submissionMarker = {
      [`_section_${body.sectionId}_submitted`]: true,
      [`_section_${body.sectionId}_submitted_at`]: new Date().toISOString(),
    };

    await this.submissionService.queueAnswer(body.sessionId, {
      ...body.answers,
      ...submissionMarker,
    });
    return { status: 'section_submitted', sectionId: body.sectionId };
  }

  @Post('submit')
  async submitExam(
    @Body() body: { sessionId: string; answers?: Record<string, any> },
    @User() user: any,
  ) {
    await this.submissionService.assertSessionOwnership(
      body.sessionId,
      user?.id,
    );
    // Proctoring: a student may only finalize while the monitoring socket is
    // live. Dropping it to evade heartbeat/tab-switch tracking now blocks
    // submission until they reconnect (which resumes monitoring). The server's
    // own deadline auto-submit path does NOT go through here, so a legitimately
    // timed-out but disconnected student is still auto-submitted.
    await this.submissionService.assertLiveMonitoring(body.sessionId);
    return this.submissionService.submitExamNow(body.sessionId, body.answers);
  }
}
