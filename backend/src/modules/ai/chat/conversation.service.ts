import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UIMessage } from 'ai';
import { PrismaService } from '../../../services/prisma/prisma.service';
import type { AiActor } from '../engine/ai-types';

const HISTORY_WINDOW = 12;

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(actor: AiActor): Prisma.AiConversationWhereInput {
    return { userId: actor.userId, orgId: actor.orgId };
  }

  async list(actor: AiActor) {
    return this.prisma.aiConversation.findMany({
      where: this.scope(actor),
      select: { id: true, title: true, pinned: true, lastMessageAt: true },
      orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }],
      take: 100,
    });
  }

  async assertOwned(actor: AiActor, id: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id, ...this.scope(actor) },
      select: { id: true, title: true, pinned: true, lastMessageAt: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async create(actor: AiActor, firstText: string) {
    return this.prisma.aiConversation.create({
      data: {
        userId: actor.userId,
        orgId: actor.orgId,
        title: titleFrom(firstText),
      },
      select: { id: true, title: true, pinned: true, lastMessageAt: true },
    });
  }

  async detail(actor: AiActor, id: string) {
    const conversation = await this.assertOwned(actor, id);
    const [messages, jobs] = await Promise.all([
      this.prisma.aiMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, parts: true, metadata: true },
      }),
      this.prisma.aiJob.findMany({
        where: { conversationId: id, userId: actor.userId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          kind: true,
          status: true,
          input: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      conversation,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        metadata: m.metadata ?? undefined,
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        kind: j.kind,
        status: j.status,
        parentJobId:
          (j.input as { parentJobId?: string } | null)?.parentJobId ?? null,
        createdAt: j.createdAt,
      })),
    };
  }

  async update(
    actor: AiActor,
    id: string,
    data: { title?: string; pinned?: boolean },
  ) {
    await this.assertOwned(actor, id);
    return this.prisma.aiConversation.update({
      where: { id },
      data: {
        ...(data.title !== undefined
          ? { title: data.title.trim().slice(0, 120) || 'New chat' }
          : {}),
        ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
      },
      select: { id: true, title: true, pinned: true, lastMessageAt: true },
    });
  }

  async remove(actor: AiActor, id: string) {
    await this.assertOwned(actor, id);
    await this.prisma.aiConversation.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Last N messages only — older turns are never re-sent to the model. */
  async recentMessages(conversationId: string): Promise<UIMessage[]> {
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
      select: { id: true, role: true, parts: true },
    });
    return rows.reverse().map((row) => ({
      id: row.id,
      role: row.role as UIMessage['role'],
      parts: row.parts as unknown as UIMessage['parts'],
    }));
  }

  /** Drops everything after a message, so a regenerated reply replaces the old one. */
  async deleteAfter(conversationId: string, messageId: string) {
    const anchor = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, conversationId },
      select: { createdAt: true },
    });
    if (!anchor) return;
    await this.prisma.aiMessage.deleteMany({
      where: { conversationId, createdAt: { gt: anchor.createdAt } },
    });
  }

  async saveMessage(
    conversationId: string,
    message: UIMessage,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.$transaction([
      this.prisma.aiMessage.upsert({
        where: { id: message.id },
        create: {
          id: message.id,
          conversationId,
          role: message.role,
          parts: message.parts as unknown as Prisma.InputJsonValue,
          metadata: (metadata ?? message.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
        update: {
          parts: message.parts as unknown as Prisma.InputJsonValue,
          metadata: (metadata ?? message.metadata ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      }),
      this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
  }
}

/** Titles come from the first message, so naming a chat costs no tokens. */
function titleFrom(text: string): string {
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/^\/\w+\s*/, '')
    .trim();
  if (!clean) return 'New chat';
  return clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean;
}
