import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import type { AiActor } from './engine/ai-types';
import { AiCreditsService } from './credits/ai-credits.service';
import { ContentContextService } from './context/content-context.service';
import { AiJobsService } from './jobs/ai-jobs.service';
import { QuestionOpsService } from './generation/question-ops.service';
import { ConversationService } from './chat/conversation.service';
import { AiChatService } from './chat/ai-chat.service';
import { ContentEditService } from './edit/content-edit.service';
import { UpdateConversationDto } from './dto/update-conversation.dto';

type SessionUser = { id: string; orgId?: string | null; role: string };

const toActor = (user: SessionUser): AiActor => ({
  userId: user.id,
  orgId: user.orgId ?? null,
  role: user.role,
});

// Plan features, credits and per-plan limits are enforced inside the services
// (not with PlanGuard) so every rejection carries the exact limit, usage and
// upgrade path the UI needs.
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
export class AiController {
  constructor(
    private readonly credits: AiCreditsService,
    private readonly context: ContentContextService,
    private readonly jobs: AiJobsService,
    private readonly questionOps: QuestionOpsService,
    private readonly conversations: ConversationService,
    private readonly chat: AiChatService,
    private readonly edits: ContentEditService,
  ) {}

  @Get('usage')
  usage(@User() user: SessionUser) {
    return this.credits.summary(toActor(user));
  }

  @Get('content')
  searchContent(@User() user: SessionUser, @Query('q') q = '') {
    return this.context.search(toActor(user), String(q), 10);
  }

  @Post('jobs')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createJob(@User() user: SessionUser, @Body() body: Record<string, unknown>) {
    return this.jobs.create(toActor(user), body);
  }

  @Get('jobs/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  getJob(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.jobs.get(toActor(user), id);
  }

  @Post('jobs/:id/cancel')
  cancelJob(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.jobs.cancel(toActor(user), id);
  }

  /** Starts an AI edit of a draft, course or exam (proposes changes; nothing is saved). */
  @Post('edits')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  startEdit(@User() user: SessionUser, @Body() body: Record<string, unknown>) {
    return this.edits.start(toActor(user), body);
  }

  @Post('jobs/:id/apply')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  applyEdit(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.edits.apply(toActor(user), id, body);
  }

  @Post('jobs/:id/undo')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  undoEdit(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.edits.undo(toActor(user), id);
  }

  /** Records which course or exam a draft was saved as, so later edits target it. */
  @Post('jobs/:id/saved')
  markDraftSaved(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.edits.markSaved(toActor(user), id, body);
  }

  @Post('questions/op')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  questionOp(@User() user: SessionUser, @Body() body: Record<string, unknown>) {
    return this.questionOps.run(toActor(user), body);
  }

  @Get('conversations')
  listConversations(@User() user: SessionUser) {
    return this.conversations.list(toActor(user));
  }

  @Get('conversations/:id')
  getConversation(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.conversations.detail(toActor(user), id);
  }

  @Patch('conversations/:id')
  updateConversation(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateConversationDto,
  ) {
    return this.conversations.update(toActor(user), id, body);
  }

  @Delete('conversations/:id')
  deleteConversation(
    @User() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.conversations.remove(toActor(user), id);
  }

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async sendMessage(
    @User() user: SessionUser,
    @Body() body: Record<string, unknown>,
    @Res() reply: FastifyReply,
  ) {
    await this.chat.handle(toActor(user), body, reply);
  }
}
