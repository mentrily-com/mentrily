import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TeacherService } from './teacher.service';

/**
 * Student-group CRUD and group-based course enrollment, split out of the
 * former monolithic TeacherService (which had grown to 4,245 lines covering
 * stats, students, courses, exams, groups, and announcements all in one
 * class). This is the "Groups" section, moved verbatim with no behavior
 * change. checkAccess/getBlockedEnrollments are still owned by
 * TeacherService (they're shared with the student-enrollment methods that
 * remain there) -- injecting it here to reuse them was judged a smaller,
 * safer change than also relocating those cross-cutting helpers in this pass.
 */
@Injectable()
export class TeacherGroupsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly teacherService: TeacherService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  /**
   * The group CRUD methods below used to grant ANY user with role ADMIN
   * full read/write/delete access to ANY group platform-wide (a bare
   * `user.role === 'ADMIN'` check with no org match) — a plain global-role
   * check like the ones already fixed in monitoring.gateway.ts. Now that
   * self-serve Creator personas exist, org-scoping this is required.
   */
  private assertGroupAccess(
    group: { teacherId: string; orgId: string | null },
    user: any,
  ): void {
    if (group.teacherId === user.id) return;
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ADMIN' && group.orgId && group.orgId === user.orgId) {
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  async getGroups(user: any) {
    const cacheKey = `teacher:groups:${user.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await this.prisma.studentGroup.findMany({
      where: { teacherId: user.id },
      include: {
        students: {
          select: { id: true, name: true, email: true, rollNumber: true },
        },
        _count: { select: { students: true, announcements: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
    return response;
  }

  async getGroup(groupId: string, user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
      include: {
        students: {
          select: { id: true, name: true, email: true, rollNumber: true },
        },
        _count: { select: { students: true, announcements: true } },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);
    return group;
  }

  async createGroup(user: any, data: { name: string; emails?: string[] }) {
    if (!data.name || !data.name.trim())
      throw new BadRequestException('Group name is required');

    const group = await this.prisma.studentGroup.create({
      data: {
        name: data.name.trim(),
        teacherId: user.id,
        orgId: user.orgId || null,
      },
    });

    // If emails provided, add students in bulk
    if (data.emails && data.emails.length > 0) {
      const result = await this.addGroupStudents(group.id, data.emails, user);
      return { ...group, enrollResult: result };
    }

    return group;
  }

  async updateGroup(groupId: string, user: any, data: { name: string }) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    return this.prisma.studentGroup.update({
      where: { id: groupId },
      data: { name: data.name.trim() },
    });
  }

  async deleteGroup(groupId: string, user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    return this.prisma.studentGroup.delete({ where: { id: groupId } });
  }

  async addGroupStudents(groupId: string, emails: string[], user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    const normalizedEmails = [
      ...new Set(
        (emails || [])
          .map((email) =>
            String(email || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];

    if (normalizedEmails.length === 0) {
      return {
        summary: { totalProcessed: 0, added: 0, failed: 0 },
        details: [],
      };
    }

    const [students, groupMembers] = await Promise.all([
      this.prisma.user.findMany({
        // Scoped to the group's own org (when it has one) so a teacher
        // can't pull a student from a different organization into their
        // group just by knowing their email -- that student would then
        // be exposed to this org's group-scoped announcements/exams, and
        // the lookup itself doubles as an email-existence oracle across
        // every org on the platform. Personal/org-less groups (orgId
        // null) keep their existing, unscoped lookup unchanged.
        where: {
          email: { in: normalizedEmails },
          ...(group.orgId ? { orgId: group.orgId } : {}),
        },
        select: { id: true, email: true, name: true, role: true },
      }),
      this.prisma.studentGroup.findUnique({
        where: { id: groupId },
        select: { students: { select: { id: true } } },
      }),
    ]);

    const studentByEmail = new Map(
      students.map((s: any) => [String(s.email).toLowerCase(), s]),
    );
    const memberSet = new Set(
      (groupMembers?.students || []).map((s: any) => s.id),
    );

    const results = [];
    let addedCount = 0;
    let failedCount = 0;
    const toConnect: Array<{ id: string }> = [];

    for (const email of normalizedEmails) {
      try {
        const student = studentByEmail.get(email);
        if (!student) {
          results.push({ email, success: false, error: 'User not found' });
          failedCount++;
          continue;
        }
        if (memberSet.has(student.id)) {
          results.push({ email, success: false, error: 'Already in group' });
          failedCount++;
          continue;
        }

        memberSet.add(student.id);
        toConnect.push({ id: student.id });
        results.push({
          email,
          success: true,
          user: { id: student.id, name: student.name },
        });
        addedCount++;
      } catch (error: any) {
        results.push({ email, success: false, error: error.message });
        failedCount++;
      }
    }

    if (toConnect.length > 0) {
      // Use Prisma relation writes so group membership works consistently
      // regardless of Supabase RLS/session behavior.
      await this.prisma.studentGroup.update({
        where: { id: groupId },
        data: {
          students: {
            connect: toConnect,
          },
        },
      });
    }

    return {
      summary: {
        totalProcessed: normalizedEmails.length,
        added: addedCount,
        failed: failedCount,
      },
      details: results,
    };
  }

  async removeGroupStudent(groupId: string, studentId: string, user: any) {
    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    await this.prisma.studentGroup.update({
      where: { id: groupId },
      data: {
        students: {
          disconnect: { id: studentId },
        },
      },
    });

    return { success: true };
  }

  async enrollGroupInCourse(courseId: string, groupId: string, user: any) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Course not found');
    await this.teacherService.checkAccess(course, user);

    const group = await this.prisma.studentGroup.findUnique({
      where: { id: groupId },
      include: { students: { select: { id: true, email: true, name: true } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    this.assertGroupAccess(group, user);

    const existingCourse = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { students: { select: { id: true } } },
    });

    const enrolledSet = new Set(
      (existingCourse?.students || []).map((s: any) => s.id),
    );
    const blocked = await this.teacherService.getBlockedEnrollments(
      course,
      group.students.map((s: any) => s.id),
    );
    const toConnect: Array<{ id: string }> = [];
    let alreadyEnrolled = 0;
    let skippedNonMembers = 0;

    for (const student of group.students) {
      if (blocked.has(student.id)) {
        skippedNonMembers++;
      } else if (enrolledSet.has(student.id)) {
        alreadyEnrolled++;
      } else {
        enrolledSet.add(student.id);
        toConnect.push({ id: student.id });
      }
    }

    if (toConnect.length > 0) {
      const { error } = await (this.supabase.client as any)
        .from('_CourseStudents')
        .upsert(
          toConnect.map((item) => ({ A: courseId, B: item.id })),
          { onConflict: 'A,B' },
        );

      if (error) {
        throw new BadRequestException(
          error.message || 'Failed to enroll group in course',
        );
      }
    }

    return {
      groupName: group.name,
      totalStudents: group.students.length,
      enrolled: toConnect.length,
      alreadyEnrolled,
      skippedNonMembers,
    };
  }
}
