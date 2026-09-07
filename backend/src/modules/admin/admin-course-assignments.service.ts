import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { getEffectiveOrgId } from './admin.util';

/**
 * Teacher-to-course assignment management (list/assign/remove), split out
 * of the larger AdminService -- fully self-contained beyond the shared
 * getEffectiveOrgId helper (see admin.util.ts).
 */
@Injectable()
export class AdminCourseAssignmentsService {
  constructor(private readonly supabase: SupabaseService) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  async getCourseAssignments(
    courseId: string,
    caller: any,
    targetOrgId?: string,
  ) {
    const orgId = getEffectiveOrgId(caller, targetOrgId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, orgId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.prisma.courseAssignment.findMany({
      where: { courseId },
      include: {
        teacher: {
          select: { id: true, email: true, name: true },
        },
        assignedBy: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignTeacherToCourse(
    courseId: string,
    teacherId: string,
    caller: any,
    targetOrgId?: string,
  ) {
    const orgId = getEffectiveOrgId(caller, targetOrgId);
    const [course, teacher] = await Promise.all([
      this.prisma.course.findFirst({
        where: { id: courseId, orgId },
        select: { id: true, orgId: true },
      }),
      this.prisma.user.findFirst({
        where: { id: teacherId, orgId, role: 'TEACHER' },
        select: { id: true },
      }),
    ]);

    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return this.prisma.courseAssignment.upsert({
      where: {
        courseId_teacherId: {
          courseId,
          teacherId,
        },
      },
      update: {},
      create: {
        courseId,
        teacherId,
        assignedById: caller.id,
      },
    });
  }

  async removeTeacherFromCourse(
    courseId: string,
    teacherId: string,
    caller: any,
    targetOrgId?: string,
  ) {
    const orgId = getEffectiveOrgId(caller, targetOrgId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, orgId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.prisma.courseAssignment.deleteMany({
      where: { courseId, teacherId },
    });

    return { removed: true };
  }
}
