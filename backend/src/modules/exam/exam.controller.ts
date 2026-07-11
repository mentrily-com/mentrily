import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
  UnauthorizedException,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ExamService } from './exam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { User } from '../auth/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  toExamEnterResponseDto,
  toStudentExamResponseDto,
} from './dto/exam-response.dto';
import { shouldSanitizeSensitiveContent } from '../common/testcase-visibility.util';
import { EnterExamDto } from './dto/enter-exam.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { SaveFeedbackDto } from './dto/save-feedback.dto';

@Controller('exam')
export class ExamController {
  constructor(private examService: ExamService) {}

  private getTimeMeta() {
    const now = new Date();
    return {
      serverTimeMs: now.getTime(),
      serverTimeIso: now.toISOString(),
      // UTC reference clock. Was previously hardcoded to Asia/Kathmandu, which
      // mislabeled the exam clock for every non-Nepal user. The exam's actual
      // scheduled zone now travels with the exam payload (Exam.timeZone); the
      // countdown only needs serverTimeMs (an absolute instant), so UTC here is
      // both correct and timezone-neutral.
      timeZone: 'UTC',
      utcOffsetMinutes: 0,
    };
  }

  private isAppClient(req: any): boolean {
    const userAgent = String(req?.headers?.['user-agent'] || '').toLowerCase();
    const clientPlatform = String(
      req?.headers?.['x-client-platform'] || '',
    ).toLowerCase();

    return (
      clientPlatform.includes('electron') ||
      clientPlatform.includes('desktop') ||
      clientPlatform.includes('app') ||
      userAgent.includes('electron')
    );
  }

  private getClientIp(req: any): string {
    const forwardedFor = req?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = req?.headers?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim().length > 0) {
      return realIp.trim();
    }

    return req?.ip || '';
  }

  @Get('app-config')
  getAppConfig() {
    return this.examService.getAppConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Get('session/:sessionId/verdict')
  async getSessionVerdict(
    @Param('sessionId') sessionId: string,
    @User() user: any,
  ) {
    return this.examService.getSessionVerdict(user.id, sessionId);
  }

  @Get(':slug')
  @UseGuards(JwtAuthGuard)
  async getExam(
    @Param('slug') slug: string,
    @Query('json') json: string,
    @User() user: any,
  ) {
    const exam = await this.examService.getExamBySlug(slug, user);
    // Fail closed: anyone who isn't an explicitly privileged role gets the
    // whitelisted student payload (no answer keys, solutions, hidden tests).
    if (shouldSanitizeSensitiveContent(user)) {
      return toStudentExamResponseDto(exam);
    }
    return exam;
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug/public-status')
  async getPublicStatus(@Param('slug') slug: string, @User() user: any, @Req() req: any) {
    // See checkExamWithOrg — a missing subdomain is not an error, the
    // per-resource access rule in getPublicStatus decides reachability.
    const resolvedOrgId = await this.examService.resolveOrgIdForPublicRequest({
      subdomainHeader: req?.headers?.['x-org-subdomain'],
      tenantHost: req?.headers?.['x-tenant-host'],
      forwardedHost: req?.headers?.['x-forwarded-host'],
      host: req?.headers?.host,
    });

    const clientIp = this.getClientIp(req);
    const result = await this.examService.getPublicStatus(
      slug,
      clientIp,
      resolvedOrgId || undefined,
      user,
    );
    return {
      ...result,
      ...this.getTimeMeta(),
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug/check')
  async checkExamWithOrg(
    @Param('slug') slug: string,
    @Query('json') json: string,
    @User() user: any,
    @Req() req: any,
  ) {
    if (!json) {
      return { error: 'json=1 parameter required' };
    }

    // A missing/unrecognized subdomain just means "no org context from the
    // host" (e.g. the bare apex domain) — it is NOT an error. Whether the
    // exam is reachable from here is decided per-resource in
    // checkExamStatus (open for DEFAULT_ORG_ID content, member-scoped
    // otherwise), not by whether the host happens to map to an org.
    const resolvedOrgId = await this.examService.resolveOrgIdForPublicRequest({
      subdomainHeader: req?.headers?.['x-org-subdomain'],
      tenantHost: req?.headers?.['x-tenant-host'],
      forwardedHost: req?.headers?.['x-forwarded-host'],
      host: req?.headers?.host,
    });

    const result = await this.examService.checkExamStatus(
      slug,
      resolvedOrgId || undefined,
      user,
    );
    return {
      ...result,
      ...this.getTimeMeta(),
    };
  }

  // Protected Routes
  @UseGuards(JwtAuthGuard)
  @Post(':slug/enter')
  async enterExam(
    @Param('slug') slug: string,
    @Body() body: EnterExamDto,
    @User() user: any,
    @Req() req: any,
  ) {
    if (!user) {
      throw new UnauthorizedException('User ID required');
    }

    // OPTIMIZATION: Use lightweight ID lookup instead of full transform
    const lookup: any = await this.examService.getExamIdBySlug(slug, user);
    console.log(`[ExamController] Lookup for slug ${slug}:`, lookup);

    if (!lookup || lookup.type !== 'exam') {
      throw new BadRequestException(
        'Assessment type does not support live sessions',
      );
    }

    // Same public/scoped-org rule as everywhere else: public-org exams are
    // open to anyone, member-scoped org exams require STUDENT/ADMIN
    // membership resolved against the exam's own org — not a flat
    // user.role !== 'STUDENT' check, which blocked any account whose
    // currently active workspace/persona wasn't literally Student even on
    // exams open to everyone.
    await this.examService.assertCanEnterExam(lookup, user);

    if (lookup.examMode === 'App' && !this.isAppClient(req)) {
      throw new UnauthorizedException('APP_REQUIRED');
    }

    if (lookup.linkedCourseId) {
      await this.examService.validateCourseLinkedExamEntry(user.id, lookup.id);
    }

    const ip = this.getClientIp(req);

    if (lookup.allowedIPs && lookup.allowedIPs.trim().length > 0) {
      const allowedList = lookup.allowedIPs
        .split(',')
        .map((i: string) => i.trim());

      // Clean up ipv6 formatting (::1) or ipv4 mapped formatting (::ffff:192.168.1.1)
      const cleanIp = ip.replace(/^::ffff:/, '');
      const isAllowed = allowedList.some(
        (allowedIp: string) => allowedIp === cleanIp || allowedIp === ip,
      );

      if (!isAllowed) {
        throw new UnauthorizedException(
          'Access denied: Your IP address is not whitelisted for this exam',
        );
      }
    }

    const session = await this.examService.startSession(
      user.id,
      lookup.id,
      ip,
      body.deviceId,
      body.tabId,
      body.metadata,
    );

    return {
      ...toExamEnterResponseDto(session),
      ...this.getTimeMeta(),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  async createExam(
    @Body(new ValidationPipe({ transform: true, whitelist: false }))
    body: CreateExamDto,
    @User() user: any,
  ) {
    return this.examService.createExam(body, user);
  }

  @Get(':examId/monitoring')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  async getMonitoredStudents(@Param('examId') examId: string, @User() user: any) {
    await this.examService.assertExamOrgAccess(examId, user);
    return this.examService.getMonitoredStudents(examId);
  }

  @Get(':examId/feedbacks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  async getFeedbacks(@Param('examId') examId: string, @User() user: any) {
    await this.examService.assertExamOrgAccess(examId, user);
    const feedbacks = await this.examService.getFeedbacks(examId);
    return feedbacks.map((f: any) => ({
      id: f.id,
      userName: f.user.name || 'Anonymous',
      userEmail: f.user.email,
      rating: f.rating,
      comment: f.comment,
      time: f.timestamp.toLocaleTimeString(),
      isSeen: false, // Default
    }));
  }

  @Post(':slug/feedback')
  @UseGuards(JwtAuthGuard)
  async saveFeedback(
    @Param('slug') slug: string,
    @Body() body: SaveFeedbackDto,
    @User() user: any,
  ) {
    const userId = user.id;
    const exam = await this.examService.getExamBySlug(slug, user);
    return this.examService.saveFeedback(
      userId,
      exam.id,
      body.rating,
      body.comment || '',
    );
  }
}
