import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookEvent } from './webhook.constants';

@Injectable()
export class WebhookService {
  constructor(
    private readonly supabase: SupabaseService,
    @InjectQueue('webhook-dispatch') private readonly webhookQueue: Queue,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private getOrgId(user: any): string {
    const orgId = String(user?.orgId || '').trim();
    if (!orgId) {
      throw new ForbiddenException('Organization context required');
    }
    return orgId;
  }

  private get prismaAny() {
    return this.prisma as any;
  }

  private validateWebhookUrl(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid webhook URL format');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Webhook URL must use HTTP or HTTPS');
    }

    const hostname = parsed.hostname;

    // Check for IP address and deny any internal ranges and loopbacks
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIPv4) {
      const parts = hostname.split('.').map(Number);
      if (
        parts.length !== 4 ||
        parts.some((p) => p < 0 || p > 255)
      ) {
        throw new BadRequestException('Invalid IPv4 address');
      }

      const [p1, p2] = parts;

      if (
        p1 === 0 || // 0.0.0.0/8
        p1 === 10 || // 10.0.0.0/8
        p1 === 127 || // 127.0.0.0/8 loopback
        (p1 === 172 && p2 >= 16 && p2 <= 31) || // 172.16.0.0/12
        (p1 === 192 && p2 === 168) || // 192.168.0.0/16
        (p1 === 169 && p2 === 254) // 169.254.0.0/16 Link local
      ) {
        throw new BadRequestException('Webhook URL points to internal IP');
      }
    }

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '[::1]'
    ) {
      throw new BadRequestException('Webhook URL points to loopback');
    }
  }

  async create(user: any, dto: CreateWebhookDto) {
    const orgId = this.getOrgId(user);
    const url = dto.url.trim();

    this.validateWebhookUrl(url);

    const endpoint = await this.prismaAny.webhookEndpoint.create({
      data: {
        orgId,
        url,
        secret: randomBytes(24).toString('hex'),
        events: dto.events,
        isActive: dto.isActive ?? true,
      },
    });

    return endpoint;
  }

  async list(user: any) {
    const orgId = this.getOrgId(user);
    return this.prismaAny.webhookEndpoint.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orgId: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(user: any, id: string, dto: UpdateWebhookDto) {
    const orgId = this.getOrgId(user);

    const existing = await this.prismaAny.webhookEndpoint.findUnique({
      where: { id },
    });
    if (!existing || existing.orgId !== orgId) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const data: any = {};
    if (typeof dto.url === 'string') {
      const url = dto.url.trim();
      this.validateWebhookUrl(url);
      data.url = url;
    }
    if (Array.isArray(dto.events)) data.events = dto.events;
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    return this.prismaAny.webhookEndpoint.update({
      where: { id },
      data,
      select: {
        id: true,
        orgId: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(user: any, id: string) {
    const orgId = this.getOrgId(user);

    const existing = await this.prismaAny.webhookEndpoint.findUnique({
      where: { id },
    });
    if (!existing || existing.orgId !== orgId) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    await this.prismaAny.webhookEndpoint.delete({ where: { id } });
    return { success: true };
  }

  async dispatch(
    orgId: string,
    event: WebhookEvent,
    payload: Record<string, any>,
  ) {
    const endpoints: Array<{
      id: string;
      orgId: string;
      url: string;
      secret: string;
    }> = await this.prismaAny.webhookEndpoint.findMany({
      where: {
        orgId,
        isActive: true,
        events: { has: event },
      },
      select: {
        id: true,
        orgId: true,
        url: true,
        secret: true,
      },
    });

    if (endpoints.length === 0) {
      return;
    }

    await this.webhookQueue.addBulk(
      endpoints.map((endpoint) => ({
        name: 'dispatch',
        data: {
          endpoint,
          event,
          payload,
          timestamp: new Date().toISOString(),
        },
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      })) as any,
    );
  }
}
