import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { PrismaService } from './services/prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReady() {
    const startedAt = Date.now();
    let databaseLatencyMs: number | null = null;
    let redisLatencyMs: number | null = null;
    let databaseStatus: 'up' | 'down' = 'down';
    let redisStatus: 'up' | 'down' = 'down';

    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      databaseLatencyMs = Date.now() - dbStart;
      databaseStatus = 'up';
    } catch {
      databaseStatus = 'down';
    }

    try {
      const redisStart = Date.now();
      await this.redis.ping();
      redisLatencyMs = Date.now() - redisStart;
      redisStatus = 'up';
    } catch {
      redisStatus = 'down';
    }

    const memoryUsage = process.memoryUsage();
    const allHealthy = databaseStatus === 'up' && redisStatus === 'up';

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: {
        total: Date.now() - startedAt,
        database: databaseLatencyMs,
        redis: redisLatencyMs,
      },
      services: {
        database: databaseStatus,
        redis: redisStatus,
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
    };
  }
}
