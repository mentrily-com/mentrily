import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { StorageService } from '../../services/storage/storage.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * Announcement CRUD, split out of the former monolithic TeacherService --
 * see teacher-groups.service.ts for the full context on why. Fully
 * self-contained: unlike Groups, this section didn't share any helpers with
 * the rest of TeacherService beyond its own assertAnnouncementAccess.
 */
@Injectable()
export class TeacherAnnouncementsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationGateway: NotificationGateway,
    private readonly storageService: StorageService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  /** Same bare-ADMIN-bypass bug as TeacherGroupsService.assertGroupAccess, same fix. */
  private assertAnnouncementAccess(
    announcement: { teacherId: string; orgId: string | null },
    user: any,
  ): void {
    if (announcement.teacherId === user.id) return;
    if (user.role === 'SUPER_ADMIN') return;
    if (
      user.role === 'ADMIN' &&
      announcement.orgId &&
      announcement.orgId === user.orgId
    ) {
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  async getAnnouncements(user: any) {
    const cacheKey = `teacher:announcements:${user.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.prisma.announcement.findMany({
      where: { teacherId: user.id },
      include: {
        groups: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async createAnnouncement(
    user: any,
    data: {
      title: string;
      content: string;
      groupIds: string[];
      attachments?: { name: string; url: string; type: string; size: number }[];
    },
  ) {
    if (!data.title?.trim()) throw new BadRequestException('Title is required');
    if (!data.content?.trim())
      throw new BadRequestException('Content is required');
    if (!data.groupIds || data.groupIds.length === 0)
      throw new BadRequestException('At least one group must be selected');

    // Verify all groups belong to this teacher
    const groups = await this.prisma.studentGroup.findMany({
      where: { id: { in: data.groupIds }, teacherId: user.id },
      include: { students: { select: { id: true } } },
    });
    if (groups.length !== data.groupIds.length) {
      throw new ForbiddenException(
        'One or more groups not found or not owned by you',
      );
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        title: data.title.trim(),
        content: data.content,
        attachments: data.attachments || [],
        teacherId: user.id,
        orgId: user.orgId || null,
        groups: { connect: data.groupIds.map((id) => ({ id })) },
      },
      include: {
        groups: { select: { id: true, name: true } },
        teacher: { select: { name: true } },
      },
    });

    // Collect unique student IDs from all target groups
    const studentIdSet = new Set<string>();
    for (const group of groups) {
      for (const student of group.students) {
        studentIdSet.add(student.id);
      }
    }

    // Broadcast via WebSocket
    await this.notificationGateway.broadcastAnnouncement(
      {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        attachments: announcement.attachments,
        teacherName: announcement.teacher.name || 'Teacher',
        groupNames: announcement.groups.map((g) => g.name),
        createdAt: announcement.createdAt,
      },
      Array.from(studentIdSet),
    );

    return announcement;
  }

  async updateAnnouncement(
    announcementId: string,
    user: any,
    data: {
      title: string;
      content: string;
      groupIds: string[];
      attachments?: { name: string; url: string; type: string; size: number }[];
    },
  ) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { groups: { select: { id: true } } },
    });

    if (!existing) throw new NotFoundException('Announcement not found');
    this.assertAnnouncementAccess(existing, user);

    if (!data.title?.trim()) throw new BadRequestException('Title is required');
    if (!data.content?.trim())
      throw new BadRequestException('Content is required');
    if (!data.groupIds || data.groupIds.length === 0)
      throw new BadRequestException('At least one group must be selected');

    const groupOwnerId = existing.teacherId;
    const groups = await this.prisma.studentGroup.findMany({
      where: { id: { in: data.groupIds }, teacherId: groupOwnerId },
      select: { id: true },
    });

    if (groups.length !== data.groupIds.length) {
      throw new ForbiddenException(
        'One or more groups not found or not owned by the announcement teacher',
      );
    }

    const oldAttachments = Array.isArray(existing.attachments)
      ? (existing.attachments as any[])
      : [];
    const nextAttachments = data.attachments || [];
    const nextAttachmentUrls = new Set(
      nextAttachments.map((att: any) => att?.url).filter(Boolean),
    );

    for (const att of oldAttachments) {
      if (att?.url && !nextAttachmentUrls.has(att.url)) {
        await this.storageService
          .deleteFile(att.url, existing.orgId || undefined)
          .catch(() => undefined);
      }
    }

    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title: data.title.trim(),
        content: data.content,
        attachments: nextAttachments,
        groups: {
          set: data.groupIds.map((id) => ({ id })),
        },
      },
      include: {
        groups: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });
  }

  async deleteAnnouncement(announcementId: string, user: any) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: { groups: true },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    this.assertAnnouncementAccess(announcement, user);

    // Delete attachment files from S3
    const attachments = announcement.attachments as any[];
    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.url) {
          await this.storageService.deleteFile(
            att.url,
            announcement.orgId || undefined,
          );
        }
      }
    }

    return this.prisma.announcement.delete({ where: { id: announcementId } });
  }
}
