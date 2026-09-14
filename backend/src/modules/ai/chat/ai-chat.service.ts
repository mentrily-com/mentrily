import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import {
  convertToModelMessages,
  createUIMessageStream,
  generateId,
  pipeUIMessageStreamToResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import type { AiActor, AiTier } from '../engine/ai-types';
import { creditsForUsage } from '../engine/ai-types';
import { OmniRouteService } from '../engine/omniroute.service';
import { AiPlanService } from '../credits/ai-plan.service';
import { AiCreditsService } from '../credits/ai-credits.service';
import { ContentContextService } from '../context/content-context.service';
import { AiJobsService } from '../jobs/ai-jobs.service';
import { briefInputSchema, referencesSchema } from '../jobs/job-input.schemas';
import {
  CHAT_INTENTS,
  ChatIntent,
  chatSystemPrompt,
} from '../prompts/chat.prompts';
import { ConversationService } from './conversation.service';
import { buildChatTools } from './chat-tools';

const MAX_USER_TEXT = 8000;
const CHAT_OUTPUT_TOKENS = 2500;

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal('user'),
    parts: z.array(z.record(z.string(), z.unknown())).min(1).max(20),
    // Display-only hints for the chat UI (command chip, reference chips).
    metadata: z
      .object({
        command: z.string().max(20).optional(),
        references: referencesSchema.optional(),
      })
      .optional(),
  }),
  intent: z
    .enum(Object.keys(CHAT_INTENTS) as [ChatIntent, ...ChatIntent[]])
    .default('ask'),
  references: referencesSchema,
  quality: z.enum(['fast', 'smart']).default('fast'),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  command: z
    .object({
      kind: z.enum(['blueprint', 'quiz']),
      brief: briefInputSchema,
      quality: z.enum(['standard', 'pro']).default('standard'),
    })
    .optional(),
});

export interface ChatMessageMetadata {
  conversationId?: string;
  credits?: number;
  tier?: AiTier;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly toolsEnabled: boolean;

  constructor(
    config: ConfigService,
    private readonly omni: OmniRouteService,
    private readonly plans: AiPlanService,
    private readonly credits: AiCreditsService,
    private readonly context: ContentContextService,
    private readonly conversations: ConversationService,
    private readonly jobs: AiJobsService,
  ) {
    this.toolsEnabled = config.get<string>('AI_CHAT_TOOLS') !== 'false';
  }

  async handle(actor: AiActor, body: unknown, reply: FastifyReply) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_AI_REQUEST',
        message: parsed.error.issues[0]?.message ?? 'Invalid chat request',
      });
    }
    const request = parsed.data;
    const userMessage = request.message as unknown as UIMessage;
    const userText = userMessage.parts
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join('\n')
      .trim()
      .slice(0, MAX_USER_TEXT);
    if (!userText && !request.command) {
      throw new BadRequestException('Message is empty');
    }

    const ctx = await this.plans.resolve(actor);
    this.plans.assertFeature(ctx, 'aiStudio');
    this.jobs.assertReferencesAllowed(ctx, request.references.length);

    const conversation = request.conversationId
      ? await this.conversations.assertOwned(actor, request.conversationId)
      : await this.conversations.create(
          actor,
          userText || request.command?.brief.topic || 'New chat',
        );

    if (request.command) {
      // Validates plan gates and reserves credits before anything streams, so
      // quota errors surface as a normal JSON error the UI can upgrade from.
      const job = await this.jobs.create(actor, {
        kind: request.command.kind,
        brief: request.command.brief,
        references: request.references,
        quality: request.command.quality,
        conversationId: conversation.id,
      });
      await this.credits.consumeMessage(ctx);
      await this.conversations.saveMessage(conversation.id, userMessage);
      return this.streamJobMessage(reply, conversation.id, userMessage, {
        jobId: job.jobId,
        kind: job.kind,
        briefKind: request.command.brief.kind,
        title: request.command.brief.topic.slice(0, 120),
        estimate: job.estimate,
        canWrite: this.plans.hasFeature(ctx, 'aiExams'),
      });
    }

    await this.credits.consumeMessage(ctx);
    const tier: AiTier = request.quality === 'smart' ? 'standard' : 'lite';
    const reservation = await this.credits.reserve(
      actor,
      ctx,
      tier === 'lite' ? 8 : 25,
    );

    try {
      const referenceText = request.references.length
        ? await this.context.referenceText(actor, request.references)
        : undefined;
      if (request.trigger === 'regenerate-message') {
        await this.conversations.deleteAfter(conversation.id, userMessage.id);
      }
      const history = [
        ...(await this.conversations.recentMessages(conversation.id)).filter(
          (m) => m.id !== userMessage.id,
        ),
        userMessage,
      ];
      await this.conversations.saveMessage(conversation.id, userMessage);

      const tools = this.toolsEnabled
        ? buildChatTools(actor, this.context)
        : undefined;
      const modelMessages = await convertToModelMessages(history, {
        tools,
        ignoreIncompleteToolCalls: true,
        convertDataPart: (part) =>
          part.type === 'data-job'
            ? {
                type: 'text',
                text: `[Started an AI ${String((part.data as { briefKind?: string })?.briefKind ?? '')} generation: ${String((part.data as { title?: string })?.title ?? '')}]`,
              }
            : undefined,
      });

      const startedAt = Date.now();
      let settled = false;
      const settle = async (
        usage: Parameters<OmniRouteService['buildMeta']>[1],
        headers: Record<string, string> | undefined,
        error?: string,
      ) => {
        if (settled) return;
        settled = true;
        try {
          if (usage) {
            await this.credits.charge(
              reservation,
              this.omni.buildMeta(tier, usage, headers, startedAt),
              `chat.${request.intent}`,
              {
                conversationId: conversation.id,
                success: !error,
                errorMessage: error ?? null,
              },
            );
          }
        } finally {
          await this.credits.release(reservation);
        }
      };

      const result = streamText({
        model: this.omni.model(tier),
        system: chatSystemPrompt(request.intent, referenceText),
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(4),
        maxOutputTokens: CHAT_OUTPUT_TOKENS,
        maxRetries: 0,
        abortSignal: this.omni.signalFor(undefined, 120_000),
        onFinish: ({ totalUsage, response }) =>
          settle(totalUsage, response?.headers),
        onError: ({ error }) => {
          this.logger.warn(
            `Chat stream failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          void settle(undefined, undefined, 'stream error');
        },
      });
      // Keep generating (and billing/persisting) even if the tab disconnects.
      result.consumeStream();

      const stream = createUIMessageStream<UIMessage<ChatMessageMetadata>>({
        originalMessages: history as UIMessage<ChatMessageMetadata>[],
        generateId,
        execute: ({ writer }) => {
          writer.merge(
            result.toUIMessageStream<UIMessage<ChatMessageMetadata>>({
              sendReasoning: false,
              messageMetadata: ({ part }) => {
                if (part.type === 'start') {
                  return { conversationId: conversation.id, tier };
                }
                if (part.type === 'finish') {
                  return {
                    conversationId: conversation.id,
                    tier,
                    credits: creditsForUsage(tier, {
                      inputTokens: part.totalUsage.inputTokens ?? 0,
                      outputTokens: part.totalUsage.outputTokens ?? 0,
                      cachedTokens:
                        part.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0,
                      totalTokens: part.totalUsage.totalTokens ?? 0,
                    }),
                  };
                }
                return undefined;
              },
            }),
          );
        },
        onFinish: async ({ responseMessage }) => {
          if (responseMessage.parts.length) {
            await this.conversations
              .saveMessage(conversation.id, responseMessage)
              .catch((error: unknown) =>
                this.logger.error(
                  `Failed to save AI message: ${String(error)}`,
                ),
              );
          }
        },
        onError: () =>
          'The AI service is temporarily unavailable. Please try again.',
      });

      reply.hijack();
      await pipeUIMessageStreamToResponse({
        response: reply.raw,
        stream,
        headers: this.passthroughHeaders(reply),
      });
    } catch (error) {
      await this.credits.release(reservation);
      throw error;
    }
  }

  private async streamJobMessage(
    reply: FastifyReply,
    conversationId: string,
    userMessage: UIMessage,
    job: {
      jobId: string;
      kind: string;
      briefKind: 'course' | 'exam';
      title: string;
      estimate: number;
      canWrite: boolean;
    },
  ) {
    const noun =
      job.kind === 'quiz'
        ? 'quiz'
        : job.briefKind === 'exam'
          ? 'exam'
          : 'course';
    const text =
      job.kind === 'quiz'
        ? `Writing your quiz on **${job.title}**. It will appear below as an editable draft.`
        : job.canWrite
          ? `Designing a ${noun} outline for **${job.title}**. Review and edit it, then generate the full ${noun}.`
          : `Designing a ${noun} outline for **${job.title}**. You can review and edit it here; writing the full ${noun} is available on the Starter plan and above.`;

    const stream = createUIMessageStream<UIMessage<ChatMessageMetadata>>({
      originalMessages: [userMessage as UIMessage<ChatMessageMetadata>],
      generateId,
      execute: ({ writer }) => {
        writer.write({
          type: 'start',
          messageMetadata: { conversationId },
        });
        const textId = generateId();
        writer.write({ type: 'text-start', id: textId });
        writer.write({ type: 'text-delta', id: textId, delta: text });
        writer.write({ type: 'text-end', id: textId });
        writer.write({ type: 'data-job', data: job });
        writer.write({ type: 'finish', messageMetadata: { conversationId } });
      },
      onFinish: async ({ responseMessage }) => {
        await this.conversations.saveMessage(conversationId, responseMessage);
      },
    });

    reply.hijack();
    await pipeUIMessageStreamToResponse({
      response: reply.raw,
      stream,
      headers: this.passthroughHeaders(reply),
    });
  }

  /** CORS and security headers set by Fastify hooks live on `reply`, not raw. */
  private passthroughHeaders(reply: FastifyReply): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(reply.getHeaders())) {
      if (value === undefined) continue;
      headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    headers['cache-control'] = 'no-cache, no-transform';
    headers['x-accel-buffering'] = 'no';
    return headers;
  }
}
