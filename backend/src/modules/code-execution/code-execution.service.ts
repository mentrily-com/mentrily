import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IExecutionStrategy } from './strategies/execution-strategy.interface';
import { PrismaService } from '../../services/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CodeExecutionService {
  private queueEvents: QueueEvents | null = null;
  private readonly publicRunLimit = 25;
  private readonly maxPublicCodeLength = 20_000;
  private readonly maxPublicInputLength = 5_000;
  private readonly maxPublicTestCases = 20;

  constructor(
    @Inject('IExecutionStrategy')
    private readonly executionStrategy: IExecutionStrategy,
    private readonly prisma: PrismaService,
    @InjectQueue('code-execution') private executionQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private getQueueEvents(): QueueEvents {
    if (!this.queueEvents) {
      this.queueEvents = new QueueEvents('code-execution', {
        connection: this.executionQueue.opts.connection,
      });
    }
    return this.queueEvents;
  }

  private validateExecutionPayload(
    language: string,
    code: string,
    stdin: string,
  ) {
    const normalizedLanguage = String(language || '').trim();
    const normalizedCode = String(code || '');
    const normalizedStdin = String(stdin || '');

    if (!normalizedLanguage) {
      throw new Error('Language is required');
    }

    if (!normalizedCode.trim()) {
      throw new Error('Code is required');
    }
  }

  private validatePublicExecutionPayload(
    language: string,
    code: string,
    stdin = '',
  ) {
    this.validateExecutionPayload(language, code, stdin);

    if (String(code || '').length > this.maxPublicCodeLength) {
      throw new BadRequestException('Code is too large for public execution');
    }

    if (String(stdin || '').length > this.maxPublicInputLength) {
      throw new BadRequestException('Input is too large for public execution');
    }
  }

  getClientIp(req: any): string {
    const headers = req?.headers || {};
    const candidates = [
      headers['cf-connecting-ip'],
      headers['true-client-ip'],
      headers['x-real-ip'],
      headers['x-forwarded-for'],
      req?.ip,
      req?.socket?.remoteAddress,
    ];

    for (const candidate of candidates) {
      const value = Array.isArray(candidate) ? candidate[0] : candidate;
      const ip = String(value || '')
        .split(',')[0]
        .trim();
      if (ip) return ip;
    }

    return 'unknown';
  }

  private async consumePublicRun(ip: string) {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const hourBucket = Math.floor(now / hourMs);
    const resetAtMs = (hourBucket + 1) * hourMs;
    const resetInSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
    const key = `public-code-run:${ip}:${hourBucket}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, resetInSeconds + 60);
    }

    const remaining = Math.max(0, this.publicRunLimit - count);

    if (count > this.publicRunLimit) {
      throw new HttpException(
        {
          message: 'Public execution limit reached. Sign in to continue.',
          limit: this.publicRunLimit,
          remaining: 0,
          resetInSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return {
      limit: this.publicRunLimit,
      remaining,
      resetInSeconds,
    };
  }

  async runCode(language: string, code: string, stdin: string) {
    this.validateExecutionPayload(language, code, stdin);

    // Add job to queue
    const job = await this.executionQueue.add('execute', {
      language,
      code,
      stdin,
    });

    // Wait for the job to finish and return the result
    try {
      const result = await job.waitUntilFinished(this.getQueueEvents());
      return result;
    } catch (error) {
      throw error;
    }
  }

  async publicRunCode(
    language: string,
    code: string,
    stdin: string,
    req: any,
  ) {
    this.validatePublicExecutionPayload(language, code, stdin);
    const rateLimit = await this.consumePublicRun(this.getClientIp(req));
    const result = await this.runCode(language, code, stdin || '');

    return {
      ...result,
      rateLimit,
    };
  }

  private normalizePublicQuestionPayload(body: any) {
    const rawQuestion = body?.question && typeof body.question === 'object'
      ? body.question
      : body;
    const title = String(rawQuestion?.title || body?.title || 'Shared coding challenge')
      .trim()
      .slice(0, 160);
    const description = String(
      rawQuestion?.description ||
        body?.problemStatement ||
        body?.description ||
        '',
    ).trim();
    const codingConfig =
      rawQuestion?.codingConfig && typeof rawQuestion.codingConfig === 'object'
        ? rawQuestion.codingConfig
        : body?.codingConfig;
    const testCases = Array.isArray(codingConfig?.testCases)
      ? codingConfig.testCases
      : [];

    if (!description) {
      throw new BadRequestException('Problem statement is required');
    }

    if (!codingConfig || typeof codingConfig !== 'object') {
      throw new BadRequestException('Coding configuration is required');
    }

    if (testCases.length > this.maxPublicTestCases) {
      throw new BadRequestException(
        `Public questions can include at most ${this.maxPublicTestCases} test cases`,
      );
    }

    return {
      id: `public-${randomBytes(8).toString('hex')}`,
      type: 'Coding',
      title: title || 'Shared coding challenge',
      description,
      difficulty: rawQuestion?.difficulty || 'Practice',
      codingConfig: {
        ...codingConfig,
        testCases,
        showTestCases: codingConfig.showTestCases ?? true,
      },
    };
  }

  private async generatePublicQuestionSlug() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = randomBytes(24).toString('base64url');
      const existing = await this.prisma.publicCodingQuestion.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
    }

    throw new Error('Unable to generate public question slug');
  }

  async createPublicQuestion(body: any, user?: any, req?: any) {
    const question = this.normalizePublicQuestionPayload(body);
    const slug = await this.generatePublicQuestionSlug();
    const days = user?.id ? 30 : 3;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const creatorIp = this.getClientIp(req);

    const existingForIp = await this.prisma.publicCodingQuestion.findFirst({
      where: {
        creatorIp,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: { slug: true, expiresAt: true },
    });

    if (existingForIp) {
      throw new HttpException(
        {
          message:
            'Only one active shared question can be created per IP.',
          slug: existingForIp.slug,
          expiresAt: existingForIp.expiresAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const record = await this.prisma.publicCodingQuestion.create({
      data: {
        slug,
        question,
        creatorUserId: user?.id || null,
        creatorIp,
        expiresAt,
      },
      select: {
        slug: true,
        question: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      ...record,
      validityDays: days,
      path: `/playground/q/${record.slug}`,
    };
  }

  async getPublicQuestion(slug: string) {
    const normalizedSlug = String(slug || '').trim();
    if (!normalizedSlug) {
      throw new NotFoundException('Question not found');
    }

    const record = await this.prisma.publicCodingQuestion.findUnique({
      where: { slug: normalizedSlug },
      select: {
        slug: true,
        question: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Question not found');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('This shared question link has expired');
    }

    return record;
  }

  async publicSubmitCode(
    questionSlug: string,
    language: string,
    code: string,
    req: any,
  ) {
    this.validatePublicExecutionPayload(language, code, '');
    const rateLimit = await this.consumePublicRun(this.getClientIp(req));
    const publicQuestion = await this.getPublicQuestion(questionSlug);
    const question: any = publicQuestion.question;
    const testCases = Array.isArray(question?.codingConfig?.testCases)
      ? question.codingConfig.testCases
      : [];

    const result = await this.submitCode(
      String(question?.id || questionSlug),
      language,
      code,
      undefined,
      testCases,
    );

    return {
      ...result,
      rateLimit,
    };
  }

  async submitCode(
    unitId: string,
    language: string,
    code: string,
    examId?: string,
    testCasesBody?: any[],
    user?: any,
  ) {
    this.validateExecutionPayload(language, code, '');

    let testCases: any[] = [];

    if (examId) {
      // Tenancy check FIRST, independent of the questions cache below —
      // any authenticated user could otherwise run/grade against another
      // org's exam questions just by knowing/guessing its examId, since
      // this endpoint previously carried no org scoping at all.
      const examOrg = await this.prisma.exam.findFirst({
        where: { OR: [{ id: examId }, { slug: examId }] },
        select: { orgId: true },
      });
      if (!examOrg) {
        throw new NotFoundException('Exam not found');
      }
      if (
        user &&
        user.role !== 'SUPER_ADMIN' &&
        examOrg.orgId &&
        examOrg.orgId !== user.orgId
      ) {
        throw new ForbiddenException('You do not have access to this exam');
      }

      // PERFORMANCE: Cache exam questions to avoid fetching large JSON blobs on every run
      const cacheKey = `exam:questions:${examId}`;
      const cachedQuestions = await this.redis.get(cacheKey);

      let questionsData: any = null;

      if (cachedQuestions) {
        questionsData = JSON.parse(cachedQuestions);
      } else {
        // Handle Exam Question
        const exam = await this.prisma.exam.findFirst({
          where: {
            OR: [{ id: examId }, { slug: examId }],
          },
          select: { id: true, questions: true, slug: true },
        });

        if (!exam) {
          throw new NotFoundException('Exam not found');
        }
        questionsData = exam.questions;

        // Cache for 10 minutes - exam content rarely changes during the exam
        // We use both ID and Slug as key to ensure hits
        await this.redis.set(
          `exam:questions:${exam.id}`,
          JSON.stringify(questionsData),
          'EX',
          600,
        );
        if (exam.slug) {
          await this.redis.set(
            `exam:questions:${exam.slug}`,
            JSON.stringify(questionsData),
            'EX',
            600,
          );
        }
      }

      // Find question in exam.questions
      let foundQuestion: any = null;

      // Helper to find question in sections or flat list
      if (Array.isArray(questionsData)) {
        // Check if it's sections or flat
        if (questionsData.length > 0 && questionsData[0].questions) {
          // Sections
          for (const section of questionsData) {
            const q = section.questions?.find((q: any) => q.id === unitId);
            if (q) {
              foundQuestion = q;
              break;
            }
          }
        } else {
          // Flat
          foundQuestion = questionsData.find((q: any) => q.id === unitId);
        }
      } else if (questionsData?.sections) {
        for (const section of questionsData.sections) {
          const q = section.questions?.find((q: any) => q.id === unitId);
          if (q) {
            foundQuestion = q;
            break;
          }
        }
      } else if (typeof questionsData === 'object' && questionsData !== null) {
        // Handle object structure like { "sec-1": { questions: [] } }
        const sections = Object.values(questionsData);
        for (const section of sections as any[]) {
          if (
            section &&
            typeof section === 'object' &&
            section.questions &&
            Array.isArray(section.questions)
          ) {
            const q = section.questions.find((q: any) => q.id === unitId);
            if (q) {
              foundQuestion = q;
              break;
            }
          }
        }
      }

      if (!foundQuestion) {
        console.log(`Question not found. ExamId: ${examId}, UnitId: ${unitId}`);
        console.log('Questions Data keys:', Object.keys(questionsData || {}));
        throw new NotFoundException('Question not found in exam');
      }

      // Check for testCases in root OR in codingConfig (to match Unit behavior)
      testCases =
        foundQuestion.testCases || foundQuestion.codingConfig?.testCases || [];
    } else {
      // 1. Fetch authoritative unit test cases first
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          module: { include: { course: { select: { orgId: true } } } },
        },
      });

      if (unit) {
        // Same tenancy gap as the exam branch above: without this, any
        // authenticated user could grade against another org's unit just
        // by knowing/guessing its unitId.
        const unitOrgId = unit.module?.course?.orgId;
        if (
          user &&
          user.role !== 'SUPER_ADMIN' &&
          unitOrgId &&
          unitOrgId !== user.orgId
        ) {
          throw new ForbiddenException('You do not have access to this unit');
        }

        // Assuming unit.content follows a structure suitable for coding problems
        // generic casting, in a real app we'd want strict DTOs/Validation
        const content: any = unit.content;
        // Check for testCases in content root OR in codingConfig (if structure differs)
        testCases = content.testCases || content.codingConfig?.testCases || [];
      } else if (testCasesBody && Array.isArray(testCasesBody)) {
        // Fallback for preview/authoring flows where question is not persisted yet
        testCases = testCasesBody;
      } else {
        throw new NotFoundException('Unit not found');
      }
    }

    if (!testCases.length) {
      // Should we error or just return passed?
      // Let's assume passed but with warning or empty result
      return {
        status: 'Accepted',
        passedTests: 0,
        totalTests: 0,
        results: [],
      };
    }

    // 2. Execute against each test case
    // Use parallel execution to minimize latency
    const results = await Promise.all(
      testCases.map(async (testCase) => {
        const input = testCase.input || '';
        const expectedOutput = (
          testCase.expectedOutput ||
          testCase.output ||
          ''
        ).trim();
        const isPublic = testCase.isPublic !== false; // Default to true if undefined, unless explicitly false

        try {
          // Use the queue-backed runCode method
          const executionResult = await this.runCode(language, code, input);

          // Clean undefined or null outputs
          const actualOutput = (executionResult.stdout || '').trim();
          const errorOutput = (executionResult.stderr || '').trim();

          // Pass only if actual matches expected AND there are no errors
          const hasError =
            errorOutput.length > 0 ||
            (executionResult.code !== 0 && executionResult.code !== null);
          const passed = !hasError && actualOutput === expectedOutput;

          return {
            input: isPublic ? input : null,
            expectedOutput: isPublic ? expectedOutput : null,
            actualOutput: isPublic ? actualOutput : null,
            passed: passed,
            status: passed ? 'Passed' : 'Failed',
            isPublic: isPublic, // Keep track of visibility
            error: isPublic ? errorOutput || null : null,
          };
        } catch (err: any) {
          console.error(
            isPublic
              ? `Test case execution failed: ${err.message}`
              : 'Hidden test case execution failed',
          );
          return {
            input: isPublic ? input : null,
            expectedOutput: isPublic ? expectedOutput : null,
            actualOutput: null,
            passed: false,
            status: 'Error',
            isPublic: isPublic,
            error: isPublic
              ? 'Execution failed: ' + (err.message || 'Unknown error')
              : null,
          };
        }
      }),
    );

    const passedCount = results.filter((r) => r.passed).length;

    // 3. Determine final status
    const allPassed = passedCount === testCases.length;

    return {
      status: allPassed ? 'Accepted' : 'Wrong Answer',
      passedTests: passedCount,
      totalTests: testCases.length,
      results: results,
    };
  }
}
