import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Plan } from '@prisma/client';
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
    if (cached) return JSON.parse(cached);

    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { domain: domain }, // Exact match
          { domain: { equals: domain, mode: 'insensitive' } }, // Case insensitive
        ],
      },
      select: {
        name: true,
        logo: true,
        primaryColor: true,
        domain: true,
        plan: true,
      },
    });

    if (!org) {
      // Check if it matches "subdomain.mentrily.com" logic if stored differently
      // But currently we store the full domain or subdomain?
      // CreateOrganizationView stores: `${formData.subdomain}.mentrily.com`
      // So if input is 'acme', we search 'acme.mentrily.com'?
      // The Frontend sends `parts[0]` which is 'acme'.
      // So we should search for `domain` STARTS WITH or EQUALS `${domain}.mentrily.com`

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
          plan: true,
        },
      });

      if (!orgBySub) throw new NotFoundException('Organization not found');
      const payload =
        orgBySub.plan === Plan.ENTERPRISE
          ? orgBySub
          : this.getDefaultBranding(orgBySub.domain || domain);
      await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);
      return payload;
    }

    const payload =
      org.plan === Plan.ENTERPRISE
        ? org
        : this.getDefaultBranding(org.domain || domain);
    await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600);
    return payload;
  }
}
