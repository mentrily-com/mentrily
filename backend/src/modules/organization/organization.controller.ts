import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { getAppName } from '../../config/app-brand';

@Controller('organization')
export class OrganizationController {
  constructor(
    private prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private getDefaultBranding(domain: string) {
    return {
      name: getAppName(),
      logo: null,
      primaryColor: '#008D98',
      domain,
    };
  }

  @Get('public')
  async getPublicOrg(@Query('domain') domain: string) {
    if (!domain) throw new NotFoundException('Domain required');

    // CACHE
    const cacheKey = `org:public:${domain.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.notFound) throw new NotFoundException('Organization not found');
      return parsed;
    }

    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { domain: domain }, // Exact match
          { domain: { equals: domain, mode: 'insensitive' } }, // Case insensitive
        ],
      },
      // This endpoint is unauthenticated (public branding for a login/
      // landing page reachable by domain guessing) -- plan is deliberately
      // excluded so anonymous callers can't enumerate which orgs are on
      // which tier.
      select: {
        name: true,
        logo: true,
        primaryColor: true,
        domain: true,
      },
    });

    if (!org) {
      // Check if it matches "subdomain.mentrily.com" logic if stored differently
      const orgBySub = await this.prisma.organization.findFirst({
        where: {
          domain: {
            startsWith: domain + '.',
            mode: 'insensitive',
          },
        },
        select: {
          name: true,
          logo: true,
          primaryColor: true,
          domain: true,
        },
      });

      if (!orgBySub) {
        await this.redis.set(
          cacheKey,
          JSON.stringify({ notFound: true }),
          'EX',
          60,
        );
        throw new NotFoundException('Organization not found');
      }
      const payload = orgBySub;
      await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);
      return payload;
    }

    const payload = org;
    await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);
    return payload;
  }
}
