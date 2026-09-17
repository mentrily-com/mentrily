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

  getHello() {
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const uptimeFormatted = `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds}s`;

    return {
      name: 'Mentrily API Gateway',
      status: 'online',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      message: 'Mentrily Platform API is fully operational and serving requests.',
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      uptimeSeconds: uptimeSec,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      endpoints: {
        health: '/api/health',
        readiness: '/api/ready',
        serverTime: '/api/time',
        documentation: 'https://mentrily.com/docs',
      },
    };
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
