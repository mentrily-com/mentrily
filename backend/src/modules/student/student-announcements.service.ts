import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * Student-facing announcement listing/read-tracking, split out of the
 * larger StudentService (1,596 lines covering dashboard stats, courses,
 * exams, bookmarks, certificates, and announcements). Fully self-contained
 * -- no shared helpers needed from StudentService beyond a tiny bounded-
 * number parser, duplicated here rather than adding a cross-service
 * dependency for nine lines.
 */
@Injectable()
export class StudentAnnouncementsService {
  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private parseBoundedNumber(
    value: string | number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(numeric)));
  }

  async getAnnouncements(
    userId: string,
    options?: { limit?: string | number; offset?: string | number },
  ) {
    const limit = this.parseBoundedNumber(options?.limit, 50, 1, 100);
    const offset = this.parseBoundedNumber(options?.offset, 0, 0, 10000);
    const versionKey = `student:announcements:ver:${userId}`;
    const cacheVersion = (await this.redis.get(versionKey)) || '1';
    const cacheKey = `student:announcements:${userId}:v:${cacheVersion}:limit:${limit}:offset:${offset}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const announcements = await this.prisma.announcement.findMany({
      where: {
        groups: {
          some: {
            students: {
              some: { id: userId },
            },
          },
        },
      },
      include: {
        teacher: { select: { name: true, profilePicture: true } },
        groups: { select: { id: true, name: true } },
        reads: {
          where: { userId },
          select: { id: true, readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const response = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      attachments: a.attachments,
      teacherName: a.teacher.name || 'Teacher',
      teacherPicture: a.teacher.profilePicture,
      groupNames: a.groups.map((g) => g.name),
      isRead: a.reads.length > 0,
      readAt: a.reads[0]?.readAt || null,
      createdAt: a.createdAt,
    }));

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
    return response;
  }

  async getUnreadAnnouncementCount(userId: string) {
    const cacheKey = `student:announcements:unread:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const count = await this.prisma.announcement.count({
      where: {
        groups: {
          some: {
            students: {
              some: { id: userId },
            },
          },
        },
        reads: {
          none: { userId },
        },
      },
    });

    const response = { count };
    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async markAnnouncementRead(userId: string, announcementId: string) {
    const result = await this.prisma.announcementRead.upsert({
      where: {
        userId_announcementId: { userId, announcementId },
      },
      create: { userId, announcementId },
      update: {},
    });

    await this.redis.del(`student:announcements:unread:${userId}`);
    await this.redis.incr(`student:announcements:ver:${userId}`);

    return result;
  }
}
