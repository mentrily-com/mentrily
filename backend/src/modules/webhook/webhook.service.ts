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

  async create(user: any, dto: CreateWebhookDto) {
    const orgId = this.getOrgId(user);

    const endpoint = await this.prismaAny.webhookEndpoint.create({
      data: {
        orgId,
        url: dto.url.trim(),
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
    if (typeof dto.url === 'string') data.url = dto.url.trim();
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
