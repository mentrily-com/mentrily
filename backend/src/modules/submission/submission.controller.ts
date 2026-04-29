import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SubmissionService } from './submission.service';

@Controller('submission')
export class SubmissionController {
  constructor(private submissionService: SubmissionService) {}

  @Post('save-answer')
  async saveAnswer(
    @Body() body: { sessionId: string; sectionId: string; answer: any },
  ) {
    await this.submissionService.queueAnswer(body.sessionId, body.answer);
    return { status: 'queued' };
  }

  @Post('section')
  async submitSection(
    @Body() body: { sessionId: string; sectionId: string; answers: any },
  ) {
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
  ) {
    return this.submissionService.submitExamNow(body.sessionId, body.answers);
  }
}
