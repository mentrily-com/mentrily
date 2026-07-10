import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import type { FastifyRequest } from 'fastify';
import { BillingService } from './billing.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly orgProvisioningService: OrgProvisioningService,
  ) {}

  private async isOrgTeacher(user: any): Promise<boolean> {
    const role = String(user?.role || '').toUpperCase();
    const orgId = String(user?.orgId || '').trim();
    if (role !== 'TEACHER' || !orgId) return false;

    // orgId being set no longer proves "invited into someone else's org" —
    // become-creator hands a Teacher their own personal org+role in one
    // click. Only block self-service when they're a Teacher INSIDE an org
    // they don't personally own.
    const ownsOrg = await this.billingService.isSelfOwnedPersonalOrg(
      String(user.id || ''),
      orgId,
    );
    return !ownsOrg;
  }

  private async ensureBillingMutationAllowed(user: any) {
    if (await this.isOrgTeacher(user)) {
      throw new ForbiddenException({
        code: 'ORG_BILLING_MANAGED_BY_ADMIN',
        message: 'Organization billing is managed by organization admins.',
      });
    }

    const role = String(user?.role || '').toUpperCase();
    if (role !== 'TEACHER') return;

    const teacherSelfBillingEnabled =
      user?.features?.teacherSelfBilling !== false;
    if (!teacherSelfBillingEnabled) {
      throw new ForbiddenException({
        code: 'TEACHER_BILLING_DISABLED',
        message: 'Teacher self-billing is disabled by your administrator.',
      });
    }
  }

  @Post('checkout-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER', 'SUPER_ADMIN')
  async createCheckoutSession(
    @User() user: any,
    @Body() body: { priceId?: string; successUrl?: string; cancelUrl?: string },
  ) {
    await this.ensureBillingMutationAllowed(user);

    if (!body?.priceId) {
      throw new BadRequestException('priceId is required');
    }

    const targetPlan = this.billingService.getPlanFromPriceId(body.priceId);
    // Bill the org the caller is ACTUALLY in (the resolved active org — e.g.
    // their become-creator personal org), not a re-derivation from the flat
    // User.orgId which, for a learner-turned-creator, points at their learner
    // home. Only provision a fresh org when the caller has no active org at all
    // (an org-less solo teacher upgrading for the first time).
    const existingOrgId = String(user?.orgId || '').trim();
    let orgId = existingOrgId;
    let provisionedNewOrg = false;

    if (!existingOrgId && targetPlan !== 'FREE') {
      orgId = await this.orgProvisioningService.ensureOrgForUser(user.id);
      provisionedNewOrg = Boolean(orgId);
    }

    if (!orgId && targetPlan !== 'FREE') {
      throw new BadRequestException('Organization provisioning failed');
    }

    // Only when we just provisioned a brand-new org for a previously org-less
    // teacher do we migrate their personal resources under it, so the dashboard
    // doesn't look empty while Stripe/webhook/session state catches up.
    if (targetPlan !== 'FREE' && provisionedNewOrg && orgId) {
      await this.orgProvisioningService.migratePersonalResourcesToOrg(
        user.id,
        orgId,
      );
    }

    const successUrl = String(body.successUrl || '').trim();
    const cancelUrl = String(body.cancelUrl || '').trim();

    return this.billingService.createCheckoutSession(
      orgId,
      body.priceId,
      successUrl || undefined,
      cancelUrl || undefined,
    );
  }

  @Post('portal-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER', 'SUPER_ADMIN')
  async createPortalSession(
    @User() user: any,
    @Body() body: { returnUrl?: string },
  ) {
    await this.ensureBillingMutationAllowed(user);

    const orgId = String(user?.orgId || '').trim();
    if (!orgId) {
      throw new BadRequestException('Organization context required');
    }

    const returnUrl = String(body?.returnUrl || '').trim();
    return this.billingService.createPortalSession(
      orgId,
      returnUrl || undefined,
    );
  }

  @Post('sync-checkout-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER', 'SUPER_ADMIN')
  async syncCheckoutSession(
    @User() user: any,
    @Body() body: { sessionId?: string },
  ) {
    await this.ensureBillingMutationAllowed(user);

    const orgId = String(user?.orgId || '').trim();
    if (!orgId) {
      throw new BadRequestException('Organization context required');
    }

    const sessionId = String(body?.sessionId || '').trim();
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    return this.billingService.syncCheckoutSession(orgId, sessionId);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TEACHER', 'SUPER_ADMIN')
  async getUsage(@User() user: any) {
    return this.billingService.getUsage({
      orgId: String(user?.orgId || '').trim() || null,
      userId: String(user?.id || '').trim() || null,
    });
  }

  @Get('plans')
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Post('stripe/webhook')
  @SkipThrottle()
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: FastifyRequest,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = (req as any).rawBody;
    const payload = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(
          typeof rawBody === 'string'
            ? rawBody
            : JSON.stringify((req as any).body || {}),
        );

    return this.billingService.handleWebhookEvent(payload, signature);
  }
}
