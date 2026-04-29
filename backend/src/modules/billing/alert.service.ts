import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';
import { MailService } from '../../services/mail.service';
import { PLAN_LIMITS, PlanKey } from '../../config/plan-limits';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async checkStorageAlert(orgId: string): Promise<void> {
    const org = (await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        plan: true,
        storageUsedMb: true,
        storageAlertSent: true,
        billingEmail: true,
      },
    } as any)) as any;

    if (!org) return;
    if (org.storageAlertSent) return;

    const limit = PLAN_LIMITS[(org.plan as PlanKey) || 'FREE'].storageMb;
    if (limit <= 0) return;

    const used = Number(org.storageUsedMb || 0);
    const ratio = used / limit;
    if (ratio < 0.9) return;

    const reserved = await this.prisma.organization.updateMany({
      where: { id: org.id, storageAlertSent: false },
      data: { storageAlertSent: true },
    } as any);

    if (!reserved.count) return;

    try {
      await this.mailService.sendStorageQuotaAlertEmail({
        orgName: org.name,
        toEmail: org.billingEmail || undefined,
        usedMb: used,
        limitMb: limit,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send storage alert for org ${org.id}: ${String(error?.message || 'unknown_error')}`,
      );
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { storageAlertSent: false },
      } as any);
    }
  }

  async checkStudentAlert(orgId: string): Promise<void> {
    const org = (await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        plan: true,
        studentCount: true,
        studentAlertSent: true,
        billingEmail: true,
      },
    } as any)) as any;

    if (!org) return;
    if (org.studentAlertSent) return;

    const limit = PLAN_LIMITS[(org.plan as PlanKey) || 'FREE'].students;
    if (limit <= 0) return;

    const students = Number(org.studentCount || 0);
    const ratio = students / limit;
    if (ratio < 0.8) return;

    const reserved = await this.prisma.organization.updateMany({
      where: { id: org.id, studentAlertSent: false },
      data: { studentAlertSent: true },
    } as any);

    if (!reserved.count) return;

    try {
      await this.mailService.sendStudentQuotaAlertEmail({
        orgName: org.name,
        toEmail: org.billingEmail || undefined,
        studentCount: students,
        limit,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send student alert for org ${org.id}: ${String(error?.message || 'unknown_error')}`,
      );
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { studentAlertSent: false },
      } as any);
    }
  }
}
