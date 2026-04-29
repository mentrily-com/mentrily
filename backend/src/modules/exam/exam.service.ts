import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SupabaseService } from '../../services/supabase/supabase.service';
import {
  sanitizeQuestionForClient,
  shouldSanitizeSensitiveContent,
} from '../common/testcase-visibility.util';
import { toStudentExamResponseDto } from './dto/exam-response.dto';
import { CertificateService } from '../certificate/certificate.service';
import { NotificationGateway } from '../notification/notification.gateway';

@Injectable()
export class ExamService {
  private readonly reservedSubdomains = new Set(['www', 'app', 'api', 'admin']);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly certificateService: CertificateService,
    private readonly notificationGateway: NotificationGateway,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private isMissingExamAttemptFieldError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as any).code === 'P2022' &&
      (String((error as any)?.meta?.column || '').includes(
        'Exam.passingPercentage',
      ) ||
        String((error as any)?.meta?.column || '').includes('Exam.maxAttempts') ||
        String((error as any)?.meta?.column || '').includes(
          'Exam.attemptBufferMins',
        ))
    );
  }

  private isMissingExamSessionAttemptNumberError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as any).code === 'P2022' &&
      String((error as any)?.meta?.column || '').includes(
        'ExamSession.attemptNumber',
      )
    );
  }

  private async calculateCourseCompletionPercent(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        examUnlockThreshold: true,
        examPassThreshold: true,
        modules: {
          select: {
            units: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!course) return null;

    const unitIds = course.modules.flatMap((module) => module.units.map((unit) => unit.id));
    const completedRows =
      unitIds.length > 0
        ? await this.prisma.unitSubmission.findMany({
            where: {
              userId,
              unitId: { in: unitIds },
              status: 'COMPLETED',
            },
            select: { unitId: true },
            distinct: ['unitId'],
          })
        : [];

    const percent = unitIds.length > 0 ? Math.round((completedRows.length / unitIds.length) * 100) : 0;
    return {
      percent,
      course: {
        examUnlockThreshold: course.examUnlockThreshold,
        examPassThreshold: course.examPassThreshold,
      },
    };
  }

  private getDefaultOrgId(): string | null {
    const value = String(process.env.DEFAULT_ORG_ID || '').trim();
    return value || null;
  }

  private getRootDomain(): string {
    return String(
      process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || '',
    )
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/:\d+$/, '');
  }

  private parseSubdomainFromHost(host?: string | null): string | null {
    const value = String(host || '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');

    if (!value) return null;

    if (value === 'localhost' || value.endsWith('.localhost')) {
      const localParts = value.split('.');
      if (localParts.length > 1) {
        const localSubdomain = localParts[0] || null;
        if (!localSubdomain || this.reservedSubdomains.has(localSubdomain)) {
          return null;
        }
        return localSubdomain;
      }
      return null;
    }

    const rootDomain = this.getRootDomain();
    if (!rootDomain || !value.endsWith(`.${rootDomain}`)) {
      return null;
    }

    const prefix = value.slice(0, -`.${rootDomain}`.length);
    if (!prefix) return null;

    const subdomain = prefix.split('.')[0] || null;
    if (!subdomain || this.reservedSubdomains.has(subdomain)) {
      return null;
    }

    return subdomain;
  }

  private async resolveOrganizationIdBySubdomain(
    subdomain: string,
  ): Promise<string | null> {
    const key = `org:subdomain:${subdomain}`;
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed?.id || null;
    }

    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { domain: { equals: subdomain, mode: 'insensitive' } },
          { domain: { startsWith: `${subdomain}.`, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (!org) return null;

    await this.redis.set(key, JSON.stringify(org), 'EX', 900);
    return org.id;
  }

  async resolveOrgIdForPublicRequest(params?: {
    subdomainHeader?: string | null;
    tenantHost?: string | null;
    forwardedHost?: string | null;
    host?: string | null;
  }): Promise<string | null> {
    const tenantSubdomainFromHeader = String(params?.subdomainHeader || '')
      .trim()
      .toLowerCase();
    const tenantHost =
      params?.tenantHost || params?.forwardedHost || params?.host || null;
    const tenantSubdomain =
      tenantSubdomainFromHeader || this.parseSubdomainFromHost(tenantHost);

    if (!tenantSubdomain) {
      return this.getDefaultOrgId();
    }

    return this.resolveOrganizationIdBySubdomain(tenantSubdomain);
  }

  private countQuestions(questions: any): {
    totalQuestions: number;
    totalSections: number;
  } {
    const rawQuestions: any = questions || {};
    let totalQuestions = 0;
    let totalSections = 0;

    if (rawQuestions.sections && Array.isArray(rawQuestions.sections)) {
      totalSections = rawQuestions.sections.length;
      rawQuestions.sections.forEach((s: any) => {
        if (Array.isArray(s.questions)) {
          totalQuestions += s.questions.length;
        }
      });
    } else if (Array.isArray(rawQuestions)) {
      totalSections = 1;
      totalQuestions = rawQuestions.length;
    } else if (Object.keys(rawQuestions).length > 0) {
      totalSections = 1;
      totalQuestions = Object.keys(rawQuestions).length;
    }

    return { totalQuestions, totalSections };
  }

  async createExam(data: any) {
    try {
      return await this.prisma.exam.create({
        data: {
          title: data.title,
          slug: data.slug,
          duration: data.duration || 60,
          questions: data.questions,
          strictness: data.strictness || 'high',
        },
      });
    } catch (e) {
      if (e.code === 'P2002')
        throw new ConflictException('Slug already exists');
      throw e;
    }
  }

  async getExamIdBySlug(slug: string, user?: any) {
    const scopedOrgId = user?.orgId ?? this.getDefaultOrgId();
    const cacheOrgId = scopedOrgId || 'none';

    // PERFORMANCE: Check Cache
    const cacheKey = `exam:lookup:${cacheOrgId}:${slug}`;
    const cached = await this.redis.get(cacheKey);

    let foundData = cached ? JSON.parse(cached) : null;

    if (!foundData) {
      // Lightweight lookup for Start Session
      // 1. Exam
      const exam = await this.prisma.exam.findFirst({
        where: {
          slug,
          ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
        },
        select: {
          id: true,
          orgId: true,
          isActive: true,
          allowedIPs: true,
          examMode: true,
          linkedCourseId: true,
          maxAttempts: true,
          attemptBufferMins: true,
        },
      });

      if (exam) {
        foundData = { ...exam, type: 'exam' };
      } else {
        // 2. Course Test
        const test = await this.prisma.courseTest.findFirst({
          where: {
            slug,
            course: {
              ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
            },
          },
          select: {
            id: true,
            orgId: true,
            course: { select: { orgId: true } },
          },
        });

        if (test) {
          foundData = { id: test.id, orgId: test.course?.orgId, type: 'test' };
        } else {
          // 3. Course (Curriculum)
          const course = await this.prisma.course.findFirst({
            where: {
              slug,
              ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
            },
            select: { id: true, orgId: true },
          });
          if (course) {
            foundData = { ...course, type: 'course' };
          }
        }
      }

      if (foundData) {
        console.log(
          `[ExamService] Resolved slug '${slug}' to type '${foundData.type}' with ID: ${foundData.id}`,
        );
        await this.redis.set(cacheKey, JSON.stringify(foundData), 'EX', 3600);
      }
    }

    if (foundData) {
      if (
        foundData.type === 'exam' &&
        typeof foundData.examMode === 'undefined'
      ) {
        const examModeRecord = await this.prisma.exam.findUnique({
          where: { id: foundData.id },
          select: { examMode: true },
        });
        foundData.examMode = examModeRecord?.examMode;
      }

      if (foundData.isActive === false)
        throw new NotFoundException('Exam is not active');
      if (
        user &&
        user.role !== 'SUPER_ADMIN' &&
        foundData.orgId &&
        foundData.orgId !== user.orgId
      ) {
        throw new NotFoundException('Access Denied');
      }
      return foundData;
    }

    throw new NotFoundException('Exam not found');
  }

  async getExamBySlug(slug: string, user?: any) {
    const scopedOrgId = user?.orgId ?? this.getDefaultOrgId();
    const cacheOrgId = scopedOrgId || 'none';

    // PERFORMANCE: Check Cache
    const cacheKey = `exam:content:${cacheOrgId}:${slug}`;
    const cached = await this.redis.get(cacheKey);

    const entity = cached ? JSON.parse(cached) : null;

    if (entity) {
      // ISOLATION CHECK from Cached Data
      if (user && user.role !== 'SUPER_ADMIN') {
        if (entity.orgId && entity.orgId !== user.orgId) {
          throw new NotFoundException('Assessment not found or access denied');
        }
      }
      return this.transformExam(entity, !shouldSanitizeSensitiveContent(user));
    }

    // 1. Try finding all at once using Promise.all to reduce latency
    const [exam, courseTest, course] = await Promise.all([
      this.prisma.exam.findFirst({
        where: {
          slug,
          ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
          isActive: true,
        },
      }),
      this.prisma.courseTest.findFirst({
        where: {
          slug,
          course: {
            ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
          },
        },
        include: { course: true },
      }),
      this.prisma.course.findFirst({
        where: {
          slug,
          ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
        },
        include: {
          modules: {
            include: { units: true },
            orderBy: { order: 'asc' },
          },
        },
      }),
    ]);

    if (exam) {
      // Cache before check
      await this.redis.set(cacheKey, JSON.stringify(exam), 'EX', 3600);

      // ISOLATION CHECK
      if (user && user.role !== 'SUPER_ADMIN') {
        if (exam.orgId && exam.orgId !== user.orgId) {
          throw new NotFoundException('Assessment not found or access denied');
        }
      }
      return this.transformExam(exam, !shouldSanitizeSensitiveContent(user));
    }

    if (courseTest) {
      const mappedTest = { ...courseTest, orgId: courseTest.course.orgId };
      // Cache
      await this.redis.set(cacheKey, JSON.stringify(mappedTest), 'EX', 3600);

      // ISOLATION CHECK from Course
      if (user && user.role !== 'SUPER_ADMIN') {
        if (courseTest.course.orgId && courseTest.course.orgId !== user.orgId) {
          throw new NotFoundException('Assessment not found');
        }
      }

      console.log('Found CourseTest:', JSON.stringify(courseTest, null, 2));
      const transformed = this.transformCourseTest(
        courseTest,
        !shouldSanitizeSensitiveContent(user),
      );
      // Add startTime for frontend timer calculation
      (transformed as any).startTime =
        courseTest.startDate || courseTest.createdAt;
      return transformed;
    }

    if (course) {
      // ISOLATION CHECK
      if (user && user.role !== 'SUPER_ADMIN') {
        if (course.orgId && course.orgId !== user.orgId) {
          throw new NotFoundException('Assessment not found');
        }
      }
      return this.transformCourse(
        course,
        !shouldSanitizeSensitiveContent(user),
      );
    }

    throw new NotFoundException('Assessment not found');
  }

  async getPublicStatus(slug: string, ip?: string, orgId?: string) {
    const scopedOrgId = orgId ?? this.getDefaultOrgId();
    const cacheOrgId = scopedOrgId || 'none';

    const cacheKey = `exam:public-status:${cacheOrgId}:${slug}`;
    const cached = await this.redis.get(cacheKey);

    let payload: any = cached ? JSON.parse(cached) : null;

    if (!payload) {
      const examSelect: Record<string, boolean> = {
        title: true,
        startTime: true,
        duration: true,
        id: true,
        questions: true,
        totalMarks: true,
        allowedIPs: true,
        examMode: true,
        linkedCourseId: true,
        passingPercentage: true,
        maxAttempts: true,
        attemptBufferMins: true,
      };

      let exam: any;
      try {
        exam = await this.prisma.exam.findFirst({
          where: {
            slug,
            ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
            isActive: true,
          },
          select: examSelect as any,
        });
      } catch (error) {
        if (!this.isMissingExamAttemptFieldError(error)) {
          throw error;
        }

        delete examSelect.passingPercentage;
        delete examSelect.maxAttempts;
        delete examSelect.attemptBufferMins;

        exam = await this.prisma.exam.findFirst({
          where: {
            slug,
            ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
            isActive: true,
          },
          select: examSelect as any,
        });
      }

      if (exam) {
        const { totalQuestions, totalSections } = this.countQuestions(
          exam.questions,
        );
        payload = {
          type: 'exam',
          allowedIPs: exam.allowedIPs || null,
          linkedCourseId: exam.linkedCourseId,
          passingPercentage: exam.passingPercentage,
          maxAttempts: exam.maxAttempts,
          attemptBufferMins: exam.attemptBufferMins,
          response: {
            title: exam.title,
            startTime: exam.startTime,
            duration: exam.duration,
            examMode: exam.examMode || 'Browser',
            totalSections,
            totalQuestions,
            totalMarks: exam.totalMarks || totalQuestions,
            id: exam.id,
            linkedCourseId: exam.linkedCourseId,
            passingPercentage: exam.passingPercentage,
            maxAttempts: exam.maxAttempts,
            attemptBufferMins: exam.attemptBufferMins,
          },
        };
      } else {
        const courseTest = await this.prisma.courseTest.findFirst({
          where: {
            slug,
            course: {
              ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
            },
          },
          select: {
            title: true,
            startDate: true,
            endDate: true,
            id: true,
            questions: true,
          },
        });

        if (courseTest) {
          let duration = 60;
          if (courseTest.startDate && courseTest.endDate) {
            const diffMs =
              courseTest.endDate.getTime() - courseTest.startDate.getTime();
            duration = Math.floor(diffMs / 60000);
          }

          const { totalQuestions, totalSections } = this.countQuestions(
            courseTest.questions,
          );
          payload = {
            type: 'course-test',
            allowedIPs: null,
            response: {
              title: courseTest.title,
              startTime: courseTest.startDate,
              duration,
              totalSections,
              totalQuestions,
              totalMarks: totalQuestions,
              id: courseTest.id,
            },
          };
        }
      }

      if (payload) {
        await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 30);
      }
    }

    if (!payload) {
      throw new NotFoundException(`Exam not found for slug: ${slug}`);
    }

    if (payload.type === 'exam' && payload.allowedIPs && ip) {
      const allowedList = String(payload.allowedIPs)
        .split(',')
        .map((i: string) => i.trim());
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

    return payload.response;
  }

  private normalizeType(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('multi') || t.includes('select')) return 'MultiSelect';
    if (t.includes('mcq') || t.includes('quiz') || t.includes('choice'))
      return 'MCQ';
    if (t.includes('code') || t.includes('coding') || t.includes('program'))
      return 'Coding';
    if (t.includes('web') || t.includes('html')) return 'Web';
    if (t.includes('read') || t.includes('text') || t.includes('lesson'))
      return 'Reading';
    if (t.includes('notebook') || t.includes('jupyter')) return 'Notebook';
    return 'MCQ'; // Default fallback
  }

  public transformExam(exam: any, includeSensitive: boolean = true) {
    const questionsMap: Record<string, any> = {};
    const finalSections: any[] = [];

    // 1. Build a comprehensive map of all items found in the 'questions' JSON
    // This handles cases where 'questions' is a map of sections, or just an array
    const rawQuestions = exam.questions || {};
    const sourceMap =
      rawQuestions.sections || !Array.isArray(rawQuestions)
        ? rawQuestions.sections || rawQuestions
        : {};
    const sourceArray = Array.isArray(rawQuestions)
      ? rawQuestions
      : Object.values(sourceMap);

    const registerQuestion = (q: any, parentId?: string, index?: number) => {
      const qId = q.id || `${parentId || 'q'}-${index || Math.random()}`;
      const normalizedQ = {
        ...q,
        id: qId,
        title: q.title || `Question ${index || ''}`,
        description: q.problemStatement || q.description || '',
        type: this.normalizeType(q.type || 'MCQ'),
        mcqOptions: q.mcqOptions || q.options || q.mcq?.options,
        codingConfig: q.codingConfig || q.coding,
        webConfig: q.webConfig || q.web,
        readingContent:
          q.readingContent || q.readingConfig?.contentBlocks || q.readingConfig,
      };
      questionsMap[qId] = sanitizeQuestionForClient(
        normalizedQ,
        includeSensitive,
      );
      return qId;
    };

    // Pre-fill map from source
    sourceArray.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;
      if (Array.isArray(item.questions)) {
        item.questions.forEach((q: any, i: number) =>
          registerQuestion(q, item.id || 'sec', i + 1),
        );
      } else {
        registerQuestion(item);
      }
    });

    // 2. Process existing sections structure if present in DB
    if (Array.isArray(exam.sections) && exam.sections.length > 0) {
      exam.sections.forEach((s: any, sIdx: number) => {
        const sectionQuestions: any[] = [];
        (s.questions || []).forEach((sq: any) => {
          // Check if this ID points to a section entry in our source map
          const sourceItem = sourceMap[sq.id];
          if (sourceItem && Array.isArray(sourceItem.questions)) {
            // Spread sub-questions into this section
            sourceItem.questions.forEach((lq: any, lqIdx: number) => {
              const lqId = registerQuestion(lq, sourceItem.id, lqIdx + 1);
              sectionQuestions.push({
                id: lqId,
                status: 'unanswered',
                number: sectionQuestions.length + 1,
              });
            });
          } else if (questionsMap[sq.id]) {
            // Standard question
            sectionQuestions.push({
              ...sq,
              number: sectionQuestions.length + 1,
            });
          }
        });

        if (sectionQuestions.length > 0) {
          finalSections.push({
            ...s,
            status: sIdx === 0 ? 'active' : 'locked',
            questions: sectionQuestions,
          });
        }
      });
    }

    // 3. If no sections were built from Step 2, build from Step 1's source map
    if (finalSections.length === 0) {
      sourceArray.forEach((item: any, idx: number) => {
        if (!item || typeof item !== 'object') return;

        const sectionQuestions: any[] = [];
        if (Array.isArray(item.questions)) {
          item.questions.forEach((q: any, qIdx: number) => {
            const qId = registerQuestion(q, item.id, qIdx + 1);
            sectionQuestions.push({
              id: qId,
              status: 'unanswered',
              number: sectionQuestions.length + 1,
            });
          });

          finalSections.push({
            id: item.id || `s${idx + 1}`,
            title: item.title || `Section ${idx + 1}`,
            status: finalSections.length === 0 ? 'active' : 'locked',
            questions: sectionQuestions,
          });
        } else {
          // Handle flat questions by grouping into a default section
          const qId = registerQuestion(item, 'q', idx + 1);
          const defaultSection = finalSections.find(
            (fs) => fs.id === 'default-section',
          );
          if (defaultSection) {
            defaultSection.questions.push({
              id: qId,
              status: 'unanswered',
              number: defaultSection.questions.length + 1,
            });
          } else {
            finalSections.push({
              id: 'default-section',
              title: 'Assessment',
              status: 'active',
              questions: [{ id: qId, status: 'unanswered', number: 1 }],
            });
          }
        }
      });
    }

    const transformed = {
      ...exam,
      sections: finalSections,
      questions: questionsMap,
    };

    if (!includeSensitive) {
      return toStudentExamResponseDto(transformed);
    }

    return transformed;
  }

  public transformCourseTest(test: any, includeSensitive: boolean = true) {
    // Course Tests are already stored with 'questions' which is the sections JSON
    const questionsData = test.questions;
    // Handle both: arrays (sections list) or object with sections key
    const sections = Array.isArray(questionsData)
      ? questionsData
      : questionsData.sections || [];

    const questionsMap: Record<string, any> = {};

    // Normalize types and preserve all fields
    const normalizedSections = sections.map((s: any) => ({
      ...s,
      questions: s.questions.map((q: any) => {
        const normalizedType = this.normalizeType(q.type || 'MCQ');
        const normalizedQ = {
          ...q,
          id: q.id,
          title: q.title || 'Untitled Question',
          description: q.problemStatement || q.description || '', // Support both field names
          type: normalizedType,
          // Preserve specific configs if they exist, or map from flat structure if needed
          mcqOptions: q.mcqOptions || q.options,
          codingConfig: q.codingConfig || q.coding,
          webConfig: q.webConfig || q.web,
          readingContent:
            q.readingContent ||
            q.readingConfig?.contentBlocks ||
            q.readingConfig,
        };

        const safeQ = sanitizeQuestionForClient(normalizedQ, includeSensitive);

        // Ensure map gets the full object
        questionsMap[q.id] = safeQ;
        return safeQ;
      }),
    }));

    let duration = 60;
    if (test.startDate && test.endDate) {
      const diffMs =
        new Date(test.endDate).getTime() - new Date(test.startDate).getTime();
      duration = Math.floor(diffMs / 60000);
    }

    console.log(
      `[ExamService] Transforming CourseTest "${test.slug}". Found ${normalizedSections.length} sections.`,
    );
    normalizedSections.forEach((s: any, i: number) => {
      console.log(
        `  Section ${i + 1} ("${s.id}"): ${s.questions.length} questions`,
      );
    });

    return {
      id: test.id,
      title: test.title,
      slug: test.slug,
      duration: duration,
      sections: normalizedSections,
      questions: questionsMap, // This is critical for looking up current question
      isCourseTest: true,
      courseTitle: test.course?.title,
    };
  }

  public transformCourse(course: any, includeSensitive: boolean = true) {
    const questionsMap: Record<string, any> = {};
    const sections = course.modules.map((m: any, mIdx: number) => {
      const questions = m.units.map((u: any, uIdx: number) => {
        const qId = u.id;
        // Transform Unit to UnitQuestion format
        const unitContent = u.content;
        const normalizedType = this.normalizeType(u.type);

        const normalizedUnit = {
          ...unitContent,
          id: qId,
          title: u.title,
          type: normalizedType,
        };
        questionsMap[qId] = sanitizeQuestionForClient(
          normalizedUnit,
          includeSensitive,
        );
        return { id: qId, status: 'unanswered', number: uIdx + 1 };
      });

      return {
        id: m.id,
        title: m.title,
        status: mIdx === 0 ? 'active' : 'locked',
        questions: questions,
      };
    });

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      sections: sections,
      questions: questionsMap,
      isCourse: true,
    };
  }

  async startSession(
    userId: string,
    examId: string,
    ip: string,
    deviceId: string,
    tabId?: string,
    metadata?: any,
  ) {
    try {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: {
          linkedCourseId: true,
        },
      });

      const sessionInclude = {
        violations: {
          where: {
            type: { in: ['TAB_SWITCH', 'TAB_SWITCH_OUT', 'TAB_SWITCH_IN'] },
          },
        },
      };

      let activeSession: any = await this.prisma.examSession.findFirst({
        where: { userId, examId, status: 'IN_PROGRESS' },
        orderBy: { createdAt: 'desc' },
        include: sessionInclude,
      });

      let latestSession: any;
      try {
        latestSession = activeSession || await this.prisma.examSession.findFirst({
          where: { userId, examId },
          orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
          include: sessionInclude,
        });
      } catch (error) {
        if (!this.isMissingExamSessionAttemptNumberError(error)) {
          throw error;
        }

        latestSession = activeSession || await this.prisma.examSession.findFirst({
          where: { userId, examId },
          orderBy: [{ createdAt: 'desc' }],
          include: sessionInclude,
        });
      }

      if (exam?.linkedCourseId) {
        if (latestSession?.status === 'IN_PROGRESS') {
          if (metadata) {
            const currentAnswers =
              typeof latestSession.answers === 'string'
                ? JSON.parse(latestSession.answers)
                : latestSession.answers || {};

            const updatedAnswers = {
              ...currentAnswers,
              _internal_metadata: {
                ...(currentAnswers._internal_metadata || {}),
                ...metadata,
              },
            };

            await this.prisma.examSession.update({
              where: { id: latestSession.id },
              data: { answers: updatedAnswers },
            });
          }

          try {
            const redisKey = `session:answers:${latestSession.id}`;
            const cachedAnswers = await this.redis.get(redisKey);
            if (cachedAnswers) {
              const dbAnswers =
                typeof latestSession.answers === 'string'
                  ? JSON.parse(latestSession.answers)
                  : latestSession.answers || {};
              const redisAnswers = JSON.parse(cachedAnswers);
              (latestSession as any).answers = { ...dbAnswers, ...redisAnswers };
            }
          } catch (e) {
            console.error(
              '[ExamService] Course exam Redis answer merge failed, using DB answers:',
              e,
            );
          }

          const hasDraftScoreDetails =
            (latestSession as any).answers &&
            typeof (latestSession as any).answers === 'object' &&
            ('_internal_marks' in (latestSession as any).answers ||
              '_internal_score' in (latestSession as any).answers);

          if (typeof latestSession.score === 'number' || hasDraftScoreDetails) {
            await this.prisma.$executeRaw`
              UPDATE "ExamSession"
              SET "answers" = COALESCE("answers", '{}'::jsonb) - '_internal_marks' - '_internal_score',
                  "score" = NULL,
                  "updatedAt" = NOW()
              WHERE "id" = ${latestSession.id}
                AND "status" = 'IN_PROGRESS'
            `;
            (latestSession as any).score = null;
            if ((latestSession as any).answers && typeof (latestSession as any).answers === 'object') {
              delete (latestSession as any).answers._internal_marks;
              delete (latestSession as any).answers._internal_score;
            }
          }

          const feedbackRecord = await this.prisma.feedback.findFirst({
            where: { userId, examId },
          });

          (latestSession as any).tabSwitchOutCount = latestSession.violations.filter(
            (v: any) => v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT',
          ).length;
          (latestSession as any).tabSwitchInCount = latestSession.violations.filter(
            (v: any) => v.type === 'TAB_SWITCH_IN',
          ).length;
          (latestSession as any).feedbackDone = !!feedbackRecord;
          return latestSession;
        }

        const nextAttemptNumber = Number(latestSession?.attemptNumber || 0) + 1;
        const createData: Record<string, unknown> = {
            userId,
            examId,
            ipAddress: ip,
            deviceId,
            startTime: new Date(),
            attemptNumber: nextAttemptNumber,
            answers: metadata ? { _internal_metadata: metadata } : {},
        };

        try {
          return await this.prisma.examSession.create({
            data: createData as any,
          });
        } catch (error) {
          if (!this.isMissingExamSessionAttemptNumberError(error)) {
            throw error;
          }

          delete createData.attemptNumber;
          return await this.prisma.examSession.create({
            data: createData as any,
          });
        }
      }

      // Find existing session first to resume
      const existing =
        latestSession?.status === 'IN_PROGRESS' ? latestSession : null;

      if (existing) {
        if (existing.status === 'TERMINATED') {
          throw new ConflictException('EXAM_TERMINATED');
        }
        // If metadata changed, we could update it. But typically it stays same for the session.
        // We'll update it if provided to ensure the latest "Name/Roll No" from login is preserved.
        if (metadata) {
          const currentAnswers =
            typeof existing.answers === 'string'
              ? JSON.parse(existing.answers)
              : existing.answers || {};

          const updatedAnswers = {
            ...currentAnswers,
            _internal_metadata: {
              ...(currentAnswers._internal_metadata || {}),
              ...metadata,
            },
          };

          await this.prisma.examSession.update({
            where: { id: existing.id },
            data: { answers: updatedAnswers },
          });
        }

        // Merge Redis-cached answers with DB answers for fast restore
        // Redis may have answers that BullMQ hasn't persisted yet
        try {
          const redisKey = `session:answers:${existing.id}`;
          const cachedAnswers = await this.redis.get(redisKey);
          if (cachedAnswers) {
            const dbAnswers =
              typeof existing.answers === 'string'
                ? JSON.parse(existing.answers)
                : existing.answers || {};
            const redisAnswers = JSON.parse(cachedAnswers);
            // Merge: Redis answers take priority (they're more recent)
            (existing as any).answers = { ...dbAnswers, ...redisAnswers };
          }
        } catch (e) {
          console.error(
            '[ExamService] Redis answer merge failed, using DB answers:',
            e,
          );
        }

        // CHECK FEEDBACK STATUS
        const feedbackRecord = await this.prisma.feedback.findFirst({
          where: { userId, examId },
        });

        // Add violation counts to existing object
        (existing as any).tabSwitchOutCount = existing.violations.filter(
          (v: any) => v.type === 'TAB_SWITCH' || v.type === 'TAB_SWITCH_OUT',
        ).length;
        (existing as any).tabSwitchInCount = existing.violations.filter(
          (v: any) => v.type === 'TAB_SWITCH_IN',
        ).length;
        (existing as any).feedbackDone = !!feedbackRecord;
        return existing;
      }

      console.log(
        `[ExamService] Creating new session for examId: ${examId}, userId: ${userId}`,
      );

      const createData: any = {
        userId,
        examId,
        ipAddress: ip,
        deviceId,
        startTime: new Date(),
        attemptNumber: 1,
        answers: metadata ? { _internal_metadata: metadata } : {},
      };

      try {
        return await this.prisma.examSession.create({ data: createData });
      } catch (error) {
        if (!this.isMissingExamSessionAttemptNumberError(error)) {
          throw error;
        }
        delete createData.attemptNumber;
        return await this.prisma.examSession.create({ data: createData });
      }
    } catch (e) {
      console.error('[ExamService] Failed to start/resume session', e);
      throw e;
    }
  }

  async getAppConfig() {
    return { version: '1.0.0', features: ['monitoring', 'lockdown'] };
  }

  async checkExamStatus(slug: string, orgId?: string) {
    const scopedOrgId = orgId ?? this.getDefaultOrgId();
    const cacheOrgId = scopedOrgId || 'none';

    const cacheKey = `exam:check-status:${cacheOrgId}:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const exam = await this.prisma.exam.findFirst({
      where: {
        slug,
        ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        isActive: true,
        duration: true,
        questions: true,
        linkedCourseId: true,
      },
    });

    if (exam) {
      let response: any;
      if (!exam.isActive) {
        response = { quiz: null, error: 'Exam is not active' };
      } else {
        const { totalQuestions } = this.countQuestions(exam.questions);
        response = {
          quiz: {
            id: exam.id,
            title: exam.title,
            slug: exam.slug,
            isActive: exam.isActive,
            duration: exam.duration * 60,
            totalQuestions,
            linkedCourseId: exam.linkedCourseId,
          },
          error: null,
        };
      }

      await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
      return response;
    }

    const test = await this.prisma.courseTest.findFirst({
      where: {
        slug,
        course: {
          ...(scopedOrgId ? { orgId: scopedOrgId } : {}),
        },
      },
      select: { id: true, title: true, slug: true, questions: true },
    });

    if (test) {
      const { totalQuestions } = this.countQuestions(test.questions);
      const response = {
        quiz: {
          id: test.id,
          title: test.title,
          slug: test.slug,
          isActive: true,
          duration: 3600,
          totalQuestions,
        },
        error: null,
      };

      await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
      return response;
    }

    const response = { quiz: null, error: 'Exam not found' };
    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 15);
    return response;
  }

  async getMonitoredStudents(examId: string) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      select: {
        userId: true,
        status: true,
        ipAddress: true,
        vmDetected: true,
        startTime: true,
        endTime: true,
        user: {
          select: {
            name: true,
            rollNumber: true,
          },
        },
        violations: {
          select: {
            type: true,
            message: true,
            timestamp: true,
          },
        },
      },
    });

    return sessions.map((session: any) => ({
      name: session.user?.name || 'Unknown',
      id: session.user?.rollNumber || session.userId.substring(0, 8),
      status: session.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed',
      ip: session.ipAddress,
      tabOuts: session.violations.filter((v: any) => v.type === 'TAB_SWITCH')
        .length,
      tabIns: 0,
      vmDetected: session.vmDetected,
      vmType: session.vmDetected ? 'Generic VM' : undefined,
      appVersion: '1.0.0',
      monitors: 1,
      startTime: session.startTime.toLocaleTimeString(),
      endTime: session.endTime ? session.endTime.toLocaleTimeString() : '-',
      loginCount: 1,
      sleepDuration: '0s',
      lastActivity: 'Just now',
      isHighRisk: session.violations.length > 2 || session.vmDetected,
      logs: session.violations.map((v: any) => ({
        time: v.timestamp.toLocaleTimeString(),
        event: v.type,
        description: v.message || 'Violation detected',
      })),
    }));
  }

  async getFeedbacks(examId: string) {
    return await this.prisma.feedback.findMany({
      where: { examId },
      include: { user: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  async saveFeedback(
    userId: string,
    examId: string,
    rating: number,
    comment: string,
  ) {
    return await this.prisma.feedback.upsert({
      where: {
        userId_examId: { userId, examId },
      },
      update: {
        rating,
        comment,
        timestamp: new Date(),
      },
      create: {
        userId,
        examId,
        rating,
        comment,
        timestamp: new Date(),
      },
    });
  }

  public calculateScoreDetails(answers: any, questionsData: any) {
    if (!answers || !questionsData) {
      return { earnedMarks: 0, totalMarks: 0, percentage: 0, marksByQuestion: {} };
    }

    let earnedMarks = 0;
    let totalMarks = 0;
    const marksByQuestion: Record<string, number> = {};
    let sections = [];

    if (Array.isArray(questionsData)) {
      // Flat array of questions or sections
      if (questionsData.length > 0 && questionsData[0].questions) {
        sections = questionsData;
      } else {
        sections = [{ questions: questionsData }];
      }
    } else if (questionsData.sections) {
      sections = questionsData.sections;
    } else if (typeof questionsData === 'object') {
      // Handle case where questionsData is an object of questions
      sections = [{ questions: Object.values(questionsData) }];
    }

    sections.forEach((section: any) => {
      const questions = section.questions || [];
      questions.forEach((q: any) => {
        const questionMarks = Number(q.marks ?? q.points ?? 1) || 1;
        totalMarks += questionMarks;
        const studentAnswer = answers[q.id];
        if (studentAnswer === undefined || studentAnswer === null) {
          marksByQuestion[q.id] = 0;
          return;
        }

        const qType = (q.type || '').toUpperCase();
        let questionScore = 0;

        if (qType === 'MCQ' || qType === 'MULTISELECT') {
          const options = q.mcqOptions || q.options || [];
          const correctIds = options
            .filter((opt: any) => opt.isCorrect)
            .map((opt: any) => String(opt.id))
            .sort();
          const selectedIds = (Array.isArray(studentAnswer)
            ? studentAnswer
            : [studentAnswer])
            .filter((value: any) => value !== undefined && value !== null)
            .map((value: any) => String(value))
            .sort();

          if (
            correctIds.length > 0 &&
            correctIds.length === selectedIds.length &&
            correctIds.every((id: string, index: number) => id === selectedIds[index])
          ) {
            questionScore = questionMarks;
          }
        } else if (qType === 'CODING') {
          // Logic for coding score based on test cases passed
          const testResults =
            studentAnswer.testResults || studentAnswer.results;
          if (testResults && Array.isArray(testResults)) {
            const passed = testResults.filter((r: any) => r.passed).length;
            const total = testResults.length;
            if (total > 0) {
              questionScore = (passed / total) * questionMarks;
            }
          }
        }

        marksByQuestion[q.id] = Math.round(questionScore * 100) / 100;
        earnedMarks += questionScore;
      });
    });

    const percentage =
      totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 10000) / 100 : 0;
    return {
      earnedMarks: Math.round(earnedMarks * 100) / 100,
      totalMarks: Math.round(totalMarks * 100) / 100,
      percentage,
      marksByQuestion,
    };
  }

  public calculateScore(answers: any, questionsData: any) {
    return this.calculateScoreDetails(answers, questionsData).percentage;
  }

  async handleExamCompletion(sessionId: string) {
    const session: any = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        score: true,
        examId: true,
        exam: {
          select: {
            id: true,
            title: true,
            linkedCourseId: true,
            passingPercentage: true,
          },
        },
      },
    });

    if (!session?.exam?.linkedCourseId) {
      return { issued: false, reason: 'exam_not_linked_to_course' };
    }

    const course: any = await this.prisma.course.findUnique({
      where: { id: session.exam.linkedCourseId },
      select: {
        id: true,
        title: true,
        certificateTemplateId: true,
        examPassThreshold: true,
      },
    });

    if (!course?.certificateTemplateId) {
      return { issued: false, reason: 'no_certificate_template' };
    }

    const requiredScore = Number(
      session.exam.passingPercentage ?? course.examPassThreshold ?? 70,
    );
    const actualScore = Number(session.score ?? 0);

    if (actualScore < requiredScore) {
      return { issued: false, reason: 'exam_threshold_not_met', requiredScore };
    }

    const certificate = await this.certificateService.generateCertificate(
      session.userId,
      'exam',
      session.id,
      course.certificateTemplateId,
    );

    this.notificationGateway.notifyUser(session.userId, 'certificate_issued', {
      type: 'exam',
      certificateId: certificate?.id,
      examId: session.examId,
      examTitle: session.exam.title,
      courseId: course.id,
      courseTitle: course.title,
    });

    return { issued: true, certificateId: certificate?.id };
  }

  async validateCourseLinkedExamEntry(userId: string, examId: string) {
    const examSelect: Record<string, boolean> = {
      id: true,
      linkedCourseId: true,
      passingPercentage: true,
      maxAttempts: true,
      attemptBufferMins: true,
    };
    let exam: any;
    try {
      exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: examSelect as any,
      });
    } catch (error) {
      if (!this.isMissingExamAttemptFieldError(error)) {
        throw error;
      }

      delete examSelect.maxAttempts;
      delete examSelect.attemptBufferMins;
      delete examSelect.passingPercentage;

      exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: examSelect as any,
      });
    }

    if (!exam?.linkedCourseId) {
      return { linkedCourseId: null };
    }

    const activeAttempt = await this.prisma.examSession.findFirst({
      where: { userId, examId, status: 'IN_PROGRESS' },
      orderBy: { createdAt: 'desc' },
      select: {
        endTime: true,
        status: true,
        score: true,
      },
    });

    const latestAttemptQuery = async () => {
      if (activeAttempt) return activeAttempt;

      try {
        return await this.prisma.examSession.findFirst({
          where: { userId, examId },
          orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
          select: {
            attemptNumber: true,
            endTime: true,
            status: true,
            score: true,
          },
        });
      } catch (error) {
        if (!this.isMissingExamSessionAttemptNumberError(error)) {
          throw error;
        }

        return await this.prisma.examSession.findFirst({
          where: { userId, examId },
          orderBy: [{ createdAt: 'desc' }],
          select: {
            endTime: true,
            status: true,
            score: true,
          },
        });
      }
    };

    const [progress, latestAttempt, attemptsUsed] = await Promise.all([
      this.calculateCourseCompletionPercent(exam.linkedCourseId, userId),
      latestAttemptQuery(),
      this.prisma.examSession.count({
        where: {
          userId,
          examId,
          status: { in: ['COMPLETED', 'TERMINATED'] },
        },
      }),
    ]);

    if (!progress) {
      throw new ForbiddenException('EXAM_LOCKED');
    }

    const requiredPercent = Number(progress.course.examUnlockThreshold ?? 100);
    if (Number(progress.percent || 0) < requiredPercent) {
      throw new ForbiddenException('EXAM_LOCKED');
    }

    const maxAttempts = Number(exam.maxAttempts ?? 1);
    const passingPercentage = Number(
      exam.passingPercentage ?? progress.course.examPassThreshold ?? 70,
    );

    if (latestAttempt?.status === 'IN_PROGRESS') {
      return {
        linkedCourseId: exam.linkedCourseId,
        attemptsUsed,
        attemptsRemaining: Math.max(0, maxAttempts - attemptsUsed),
        resumable: true,
      };
    }

    if (
      latestAttempt?.status === 'COMPLETED' &&
      typeof latestAttempt.score === 'number' &&
      Number(latestAttempt.score) >= passingPercentage
    ) {
      throw new ForbiddenException({
        message: 'ALREADY_PASSED',
        score: Number(latestAttempt.score),
        passingPercentage,
        attemptsUsed,
        maxAttempts,
      });
    }

    if (attemptsUsed >= maxAttempts) {
      throw new ForbiddenException({
        message: 'NO_ATTEMPTS_LEFT',
        reason:
          latestAttempt?.status === 'TERMINATED'
            ? 'ATTEMPT_TERMINATED'
            : 'MAX_ATTEMPTS_REACHED',
        attemptsUsed,
        maxAttempts,
      });
    }

    const attemptBufferMins = Number(exam.attemptBufferMins ?? 0);
    if (latestAttempt?.endTime && attemptBufferMins > 0) {
      const resumesAt = new Date(
        new Date(latestAttempt.endTime).getTime() + attemptBufferMins * 60 * 1000,
      );
      if (resumesAt.getTime() > Date.now()) {
        throw new ConflictException({
          message: 'ATTEMPT_COOLDOWN',
          resumesAt: resumesAt.toISOString(),
        } as any);
      }
    }

    return {
      linkedCourseId: exam.linkedCourseId,
      attemptsUsed,
      attemptsRemaining: Math.max(0, maxAttempts - attemptsUsed),
    };
  }

  async getSessionVerdict(userId: string, sessionId: string) {
    const sessionSelect: any = {
      id: true,
      userId: true,
      status: true,
      score: true,
      exam: {
        select: {
          id: true,
          linkedCourseId: true,
          passingPercentage: true,
        },
      },
    };

    let session: any;
    try {
      session = await this.prisma.examSession.findUnique({
        where: { id: sessionId },
        select: sessionSelect,
      });
    } catch (error) {
      if (!this.isMissingExamAttemptFieldError(error)) {
        throw error;
      }

      delete sessionSelect.exam.select.passingPercentage;
      session = await this.prisma.examSession.findUnique({
        where: { id: sessionId },
        select: sessionSelect,
      });
    }

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'COMPLETED' || typeof session.score !== 'number') {
      return {
        ready: false,
        status: session.status,
        linkedCourseId: session.exam?.linkedCourseId || null,
      };
    }

    let courseThreshold: number | null = null;
    if (session.exam?.linkedCourseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: session.exam.linkedCourseId },
        select: { examPassThreshold: true },
      });
      courseThreshold = Number(course?.examPassThreshold ?? 70);
    }

    const passingPercentage = Number(
      session.exam?.passingPercentage ?? courseThreshold ?? 70,
    );

    return {
      ready: true,
      status: session.status,
      linkedCourseId: session.exam?.linkedCourseId || null,
      score: Number(session.score),
      passingPercentage,
      passed: Number(session.score) >= passingPercentage,
    };
  }
}
