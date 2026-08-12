import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class TestCodeRotationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TestCodeRotationService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly tickMs = 30 * 1000;
  private readonly lockTtlMs = 20 * 1000;
  private readonly rotatingExamCatalogKey = 'exam:test-code-rotation:catalog';
  private readonly rotatingExamCatalogTtlSec = 300;
  private readonly enabled =
    String(process.env.ENABLE_TEST_CODE_ROTATION || 'false').toLowerCase() ===
    'true';
  private dbRetryAfter = 0;

  constructor(
    private readonly supabase: SupabaseService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        'Test code rotation worker disabled (ENABLE_TEST_CODE_ROTATION=false)',
      );
      return;
    }

    this.timer = setInterval(() => {
      this.rotateDueExamCodes().catch((error) => {
        if (this.isDbSaturationError(error)) {
          this.dbRetryAfter = Date.now() + 60 * 1000;
          this.logger.warn(
            'Rotation tick skipped: database connection slots exhausted. Cooling down for 60s.',
          );
          return;
        }
        this.logger.error(`Rotation tick failed: ${error?.message || error}`);
      });
    }, this.tickMs);

    this.rotateDueExamCodes().catch((error) => {
      if (this.isDbSaturationError(error)) {
        this.dbRetryAfter = Date.now() + 60 * 1000;
        this.logger.warn(
          'Initial rotation tick skipped: database connection slots exhausted.',
        );
        return;
      }
      this.logger.error(
        `Initial rotation tick failed: ${error?.message || error}`,
      );
    });

    this.logger.log('Test code rotation worker started');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private generateRandomNumericCode(length: number): string {
    const normalizedLength = Math.min(10, Math.max(4, length));
    let value = '';
    for (let i = 0; i < normalizedLength; i += 1) {
      value += crypto.randomInt(0, 10).toString();
    }
    return value;
  }

  private async tryAcquireLock(): Promise<boolean> {
    const lockKey = 'exam:test-code-rotation:lock';
    const lockValue = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const result = await this.redis.set(
      lockKey,
      lockValue,
      'PX',
      this.lockTtlMs,
      'NX',
    );
    return result === 'OK';
  }

  private async rotateDueExamCodes() {
    if (Date.now() < this.dbRetryAfter) {
      return;
    }

    const gotLock = await this.tryAcquireLock();
    if (!gotLock) return;

    const now = Date.now();

    const rotatingExams = await this.getRotatingExamCatalog();

    for (const exam of rotatingExams) {
      const intervalMinutes = Number(exam.rotationInterval || 0);
      if (!intervalMinutes || intervalMinutes <= 0) continue;

      const dueAt =
        new Date(exam.updatedAt).getTime() + intervalMinutes * 60 * 1000;
      if (now < dueAt) continue;

      const currentCode = String(exam.testCode || '');
      const nextCode = this.generateRandomNumericCode(currentCode.length || 5);

      if (nextCode === currentCode) continue;

      await this.prisma.exam.update({
        where: { id: exam.id },
        data: { testCode: nextCode },
      });

      await this.redis.del(this.rotatingExamCatalogKey);

      this.logger.log(`Rotated test code for exam ${exam.slug}`);
    }
  }

  private async getRotatingExamCatalog(): Promise<
    Array<{
      id: string;
      slug: string;
      testCode: string | null;
      rotationInterval: number | null;
      updatedAt: string | Date;
    }>
  > {
    const cached = await this.redis.get(this.rotatingExamCatalogKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const rotatingExams = await this.prisma.exam.findMany({
      where: {
        isActive: true,
        testCodeType: 'Rotating',
        rotationInterval: { gt: 0 },
        testCode: { not: null },
      },
      select: {
        id: true,
        slug: true,
        testCode: true,
        rotationInterval: true,
        updatedAt: true,
      },
    });

    await this.redis.set(
      this.rotatingExamCatalogKey,
      JSON.stringify(rotatingExams),
      'EX',
      this.rotatingExamCatalogTtlSec,
    );

    return rotatingExams;
  }

  private isDbSaturationError(error: unknown): boolean {
    const message = String((error as any)?.message || '').toLowerCase();
    return (
      message.includes('too many database connections') ||
      message.includes('remaining connection slots') ||
      message.includes('p2037')
    );
  }
}
