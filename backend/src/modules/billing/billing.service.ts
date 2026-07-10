import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { MailService } from '../../services/mail.service';
import { QuotaService } from './quota.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';
import { MembershipService } from '../organization/membership.service';
const Stripe = require('stripe');
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PLAN_PRICE_MAP,
  PLANS,
  PlanKey,
  getEffectivePlanLimits,
} from '../../config/plan-limits';

type StripeEventResult = {
  received: true;
  deduplicated: boolean;
  eventType?: string;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: any = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService,
    private readonly quotaService: QuotaService,
    private readonly orgProvisioningService: OrgProvisioningService,
    private readonly membershipService: MembershipService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.initializeStripe();
  }

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  /**
   * Distinguishes "this Teacher owns this org outright" (self-serve
   * personal org — become-creator, or the classic solo-signup flow) from
   * "this Teacher was invited into someone else's shared org" (billing is
   * that org's admin's job). A Teacher's orgId being set is no longer proof
   * of the latter now that become-creator hands out a personal org+Teacher
   * role in one click — checking provisionedFromUserId is the real signal.
   */
  async isSelfOwnedPersonalOrg(
    userId: string,
    orgId: string,
  ): Promise<boolean> {
    if (!userId || !orgId) return false;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { provisionedFromUserId: true },
    });
    return org?.provisionedFromUserId === userId;
  }

  initializeStripe(): any {
    const secretKey = String(
      this.configService.get('STRIPE_SECRET_KEY') || '',
    ).trim();
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not configured. Billing endpoints will fail until configured.',
      );
      this.stripe = null;
      return this.stripe;
    }

    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }

  private getStripeClient(): any {
    if (!this.stripe) {
      this.initializeStripe();
    }

    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe client is not configured');
    }

    return this.stripe;
  }

  private getDefaultFrontendUrl(): string {
    return String(
      this.configService.get('FRONTEND_URL') ||
        this.configService.get('NEXT_PUBLIC_APP_URL') ||
        'http://localhost:3000',
    )
      .trim()
      .replace(/\/$/, '');
  }

  private isValidStripePriceId(value: string): boolean {
    return /^price_[A-Za-z0-9]+$/.test(String(value || '').trim());
  }

  private getPriceIdsFromEnv(plan: PlanKey): string[] {
    const keysByPlan: Record<PlanKey, string[]> = {
      FREE: [
        'STRIPE_PRICE_FREE',
        'STRIPE_PRICE_FREE_MONTHLY',
        'STRIPE_PRICE_FREE_ANNUAL',
      ],
      STARTER: [
        'STRIPE_PRICE_STARTER',
        'STRIPE_PRICE_STARTER_MONTHLY',
        'STRIPE_PRICE_STARTER_ANNUAL',
      ],
      PRO: [
        'STRIPE_PRICE_PRO',
        'STRIPE_PRICE_PRO_MONTHLY',
        'STRIPE_PRICE_PRO_ANNUAL',
      ],
      ENTERPRISE: [
        'STRIPE_PRICE_ENTERPRISE',
        'STRIPE_PRICE_ENTERPRISE_MONTHLY',
        'STRIPE_PRICE_ENTERPRISE_ANNUAL',
      ],
    };

    return Array.from(
      new Set(
        keysByPlan[plan]
          .map((key) => String(this.configService.get(key) || '').trim())
          .filter((value) => {
            if (!value) return false;
            const valid = this.isValidStripePriceId(value);
            if (!valid) {
              this.logger.warn(
                `Ignoring invalid Stripe price value for plan ${plan}: ${value}`,
              );
            }
            return valid;
          })
          .filter(Boolean),
      ),
    );
  }

  private getAllowedPriceIds(): string[] {
    return Array.from(
      new Set(PLANS.flatMap((plan) => this.getPriceIdsFromEnv(plan))),
    );
  }

  private resolveBillingEmail(
    contact: any,
    billingEmail?: string | null,
  ): string | undefined {
    if (billingEmail && String(billingEmail).trim()) {
      return String(billingEmail).trim();
    }

    if (!contact || typeof contact !== 'object') {
      return undefined;
    }

    const supportEmail = String(contact.supportEmail || '').trim();
    if (supportEmail) return supportEmail;

    const adminEmail = String(contact.adminEmail || '').trim();
    if (adminEmail) return adminEmail;

    return undefined;
  }

  async getOrCreateStripeCustomer(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        contact: true,
        billingEmail: true,
        stripeCustomerId: true,
      },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    if (org.stripeCustomerId) {
      return org.stripeCustomerId;
    }

    const stripe = this.getStripeClient();
    const email = this.resolveBillingEmail(org.contact, org.billingEmail);

    const customer = await stripe.customers.create({
      name: org.name,
      email,
      metadata: {
        orgId: org.id,
      },
    });

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        stripeCustomerId: customer.id,
        billingEmail: org.billingEmail || email || null,
      },
    });

    return customer.id;
  }

  async createCheckoutSession(
    orgId: string,
    priceId: string,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    const normalizedPriceId = String(priceId || '').trim();
    if (!normalizedPriceId) {
      throw new BadRequestException('priceId is required');
    }

    if (!this.isValidStripePriceId(normalizedPriceId)) {
      throw new BadRequestException(
        'Invalid Stripe priceId format. Expected a Stripe Price ID like price_xxx.',
      );
    }

    const allowedPriceIds = this.getAllowedPriceIds();
    if (!allowedPriceIds.includes(normalizedPriceId)) {
      throw new BadRequestException('Invalid or unsupported Stripe priceId');
    }

    const customerId = await this.getOrCreateStripeCustomer(orgId);
    const stripe = this.getStripeClient();
    const frontendUrl = this.getDefaultFrontendUrl();

    const resolvedSuccessUrl =
      String(successUrl || '').trim() ||
      `${frontendUrl}/dashboard/creator/billing?checkout=success`;
    const resolvedCancelUrl =
      String(cancelUrl || '').trim() ||
      `${frontendUrl}/dashboard/creator/billing?checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: normalizedPriceId, quantity: 1 }],
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      metadata: {
        orgId,
        source: 'billing_checkout',
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe checkout session missing redirect URL',
      );
    }

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(orgId: string, returnUrl?: string) {
    const customerId = await this.getOrCreateStripeCustomer(orgId);
    const stripe = this.getStripeClient();
    const frontendUrl = this.getDefaultFrontendUrl();
    const resolvedReturnUrl =
      String(returnUrl || '').trim() ||
      `${frontendUrl}/dashboard/creator/billing`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: resolvedReturnUrl,
    });

    return { url: session.url };
  }

  async syncCheckoutSession(orgId: string, sessionId: string) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const stripe = this.getStripeClient();
    let session: any;

    try {
      session = await stripe.checkout.sessions.retrieve(normalizedSessionId, {
        expand: ['subscription'],
      });
    } catch {
      throw new BadRequestException('Invalid checkout session id');
    }

    const metadataOrgId = String(session?.metadata?.orgId || '').trim();
    if (metadataOrgId && metadataOrgId !== orgId) {
      throw new ForbiddenException(
        'Checkout session does not belong to this organization',
      );
    }

    if (!metadataOrgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      });

      const sessionCustomerId =
        typeof session?.customer === 'string'
          ? session.customer
          : session?.customer?.id;

      if (
        org?.stripeCustomerId &&
        sessionCustomerId &&
        String(org.stripeCustomerId) !== String(sessionCustomerId)
      ) {
        throw new ForbiddenException(
          'Checkout session does not belong to this organization',
        );
      }
    }

    let subscription = session?.subscription;
    if (!subscription) {
      throw new BadRequestException(
        'Checkout session has no subscription to sync',
      );
    }

    if (typeof subscription === 'string') {
      subscription = await stripe.subscriptions.retrieve(subscription);
    }

    const updated = await this.syncPlanFromSubscription(
      subscription,
      undefined,
      'checkout.session.manual_sync',
    );

    if (!updated) {
      throw new BadRequestException(
        'Unable to sync subscription for this checkout session',
      );
    }

    return {
      synced: true,
      plan: updated.plan,
      stripePriceId: updated.stripePriceId,
      planExpiresAt: updated.planExpiresAt,
    };
  }

  getPlanFromPriceId(priceId: string): PlanKey {
    const normalized = String(priceId || '').trim();
    if (!normalized) {
      return 'FREE';
    }

    for (const plan of PLANS) {
      if (this.getPriceIdsFromEnv(plan).includes(normalized)) {
        return plan;
      }
    }

    return 'FREE';
  }

  private getPlanRank(plan: PlanKey): number {
    const ranks: Record<PlanKey, number> = {
      FREE: 0,
      STARTER: 1,
      PRO: 2,
      ENTERPRISE: 3,
    };

    return ranks[plan] ?? 0;
  }

  private mapStripeStatusToPlanStatus(
    status: string,
  ): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' {
    const normalized = String(status || '')
      .trim()
      .toLowerCase();

    if (normalized === 'trialing') return 'TRIALING';
    if (normalized === 'past_due') return 'PAST_DUE';
    if (normalized === 'canceled' || normalized === 'unpaid') return 'CANCELED';
    return 'ACTIVE';
  }

  private async invalidateOrgCaches(orgId: string): Promise<void> {
    const directKeys = [
      `org:features:${orgId}`,
      `org:status:${orgId}`,
      `org:effective_features:${orgId}`,
    ];

    await this.redis.del(...directKeys);

    const orgUsers = await this.prisma.user.findMany({
      where: { orgId },
      select: { clerkId: true },
    });

    const userSessionKeys = orgUsers
      .map((entry) => String(entry.clerkId || '').trim())
      .filter(Boolean)
      .map((clerkId) => `user:session:${clerkId}`);

    if (userSessionKeys.length > 0) {
      await this.redis.del(...userSessionKeys);
    }

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'user:session:*',
        'COUNT',
        200,
      );
      cursor = nextCursor;

      if (!keys || keys.length === 0) {
        continue;
      }

      const values = await this.redis.mget(keys);
      const keysToDelete: string[] = [];

      for (let index = 0; index < keys.length; index += 1) {
        const raw = values[index];
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (String(parsed?.orgId || '') === orgId) {
            keysToDelete.push(keys[index]);
          }
        } catch {
          continue;
        }
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } while (cursor !== '0');
  }

  private async createSubscriptionEventRecord(params: {
    stripeEventId: string;
    eventType: string;
    orgId: string;
    previousPlan?: PlanKey | null;
    newPlan?: PlanKey | null;
    metadata?: unknown;
  }): Promise<void> {
    await this.prisma.subscriptionEvent.create({
      data: {
        stripeEventId: params.stripeEventId,
        eventType: params.eventType,
        orgId: params.orgId,
        previousPlan: params.previousPlan || null,
        newPlan: params.newPlan || null,
        metadata: (params.metadata as any) || null,
      },
    });
  }

  private async invalidateSessionCacheByClerkIds(
    clerkIds: string[],
  ): Promise<void> {
    const normalized = Array.from(
      new Set(
        (clerkIds || [])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );

    if (normalized.length === 0) {
      return;
    }

    const directKeys = normalized.map((clerkId) => `user:session:${clerkId}`);
    await this.redis.del(...directKeys);

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'user:session:*',
        'COUNT',
        200,
      );
      cursor = nextCursor;

      if (!keys || keys.length === 0) {
        continue;
      }

      const values = await this.redis.mget(keys);
      const keysToDelete: string[] = [];

      for (let index = 0; index < keys.length; index += 1) {
        const raw = values[index];
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const clerkId = String(
            parsed?.clerkId || parsed?.user?.clerkId || '',
          ).trim();
          if (clerkId && normalized.includes(clerkId)) {
            keysToDelete.push(keys[index]);
          }
        } catch {
          continue;
        }
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } while (cursor !== '0');
  }

  async syncPlanFromSubscription(
    subscription: any,
    stripeEventId?: string,
    eventType = 'customer.subscription.updated',
  ) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      return null;
    }

    const stripePriceId = subscription.items?.data?.[0]?.price?.id || null;
    const nextPlan = this.getPlanFromPriceId(stripePriceId || '');
    const nextPlanStatus = this.mapStripeStatusToPlanStatus(
      subscription.status,
    );
    const nextExpiresAt = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, plan: true, provisionedFromUserId: true },
    });

    if (!org) {
      this.logger.warn(
        `No organization found for Stripe customer ${customerId}`,
      );
      return null;
    }

    const isUpgrade =
      this.getPlanRank(nextPlan) >
      this.getPlanRank((org.plan as PlanKey) || 'FREE');
    const isUpgradeFromFree =
      (org.plan as PlanKey) === 'FREE' && nextPlan !== 'FREE' && isUpgrade;

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: nextPlan,
        planStatus: nextPlanStatus,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        planExpiresAt: nextExpiresAt,
        ...(isUpgrade
          ? {
              storageAlertSent: false,
              studentAlertSent: false,
            }
          : {}),
      } as any,
      select: {
        id: true,
        plan: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        planExpiresAt: true,
      },
    });

    if (isUpgradeFromFree && org.provisionedFromUserId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: org.provisionedFromUserId },
        select: { orgId: true },
      });

      if (owner?.orgId === org.id) {
        // This personal org IS the owner's home org — legacy direct update,
        // no other persona to preserve.
        await this.prisma.user.update({
          where: { id: org.provisionedFromUserId },
          data: {
            role: 'ADMIN',
            orgId: org.id,
            needsRoleSelection: false,
          },
        });
      } else {
        // Owner has a different home org (e.g. they're a Learner elsewhere)
        // and this personal org is an additive Creator persona — promote
        // that persona's OrgMembership role instead of touching their home
        // org/role, same additive principle as accepting a second-org
        // invite.
        await this.membershipService.grantMembership(
          org.provisionedFromUserId,
          org.id,
          'ADMIN',
        );
      }

      await this.orgProvisioningService.migratePersonalResourcesToOrg(
        org.provisionedFromUserId,
        org.id,
      );
    }

    if (stripeEventId) {
      await this.createSubscriptionEventRecord({
        stripeEventId,
        eventType,
        orgId: org.id,
        previousPlan: org.plan as PlanKey,
        newPlan: nextPlan,
        metadata: {
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId: stripePriceId,
          currentPeriodEnd: subscription.current_period_end,
        },
      });
    }

    await this.invalidateOrgCaches(org.id);
    return updated;
  }

  async handleWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<StripeEventResult> {
    const webhookSecret = String(
      this.configService.get('STRIPE_WEBHOOK_SECRET') || '',
    ).trim();
    if (!webhookSecret) {
      throw new InternalServerErrorException('Missing STRIPE_WEBHOOK_SECRET');
    }

    const stripe = this.getStripeClient();
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error: any) {
      this.logger.warn(
        `Invalid Stripe webhook signature: ${String(error?.message || 'unknown_error')}`,
      );
      throw new BadRequestException('Invalid Stripe signature');
    }

    const existing = await this.prisma.subscriptionEvent.findUnique({
      where: { stripeEventId: event.id },
      select: { id: true },
    });

    if (existing) {
      return {
        received: true,
        deduplicated: true,
        eventType: event.type,
      };
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          await this.syncPlanFromSubscription(
            subscription,
            event.id,
            event.type,
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await this.syncPlanFromSubscription(subscription, event.id, event.type);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        if (customerId) {
          const org = await this.prisma.organization.findFirst({
            where: { stripeCustomerId: customerId },
            select: { id: true, plan: true, name: true, billingEmail: true },
          });

          if (org) {
            await this.prisma.organization.update({
              where: { id: org.id },
              data: {
                plan: 'FREE',
                planStatus: 'CANCELED',
                stripeSubscriptionId: null,
                stripePriceId: null,
                planExpiresAt: null,
              } as any,
            });

            await this.createSubscriptionEventRecord({
              stripeEventId: event.id,
              eventType: event.type,
              orgId: org.id,
              previousPlan: org.plan as PlanKey,
              newPlan: 'FREE',
              metadata: {
                subscriptionId: subscription.id,
                status: subscription.status,
              },
            });

            await this.invalidateOrgCaches(org.id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          const org: any = await this.prisma.organization.findFirst({
            where: { stripeCustomerId: customerId },
            select: { id: true, plan: true, name: true, billingEmail: true },
          });

          if (org) {
            await this.prisma.organization.update({
              where: { id: org.id },
              data: {
                planStatus: 'PAST_DUE',
              } as any,
            });

            await this.createSubscriptionEventRecord({
              stripeEventId: event.id,
              eventType: event.type,
              orgId: org.id,
              previousPlan: org.plan as PlanKey,
              newPlan: org.plan as PlanKey,
              metadata: {
                invoiceId: invoice.id,
                subscriptionId:
                  typeof invoice.subscription === 'string'
                    ? invoice.subscription
                    : invoice.subscription?.id,
                amountDue: invoice.amount_due,
                currency: invoice.currency,
                status: invoice.status,
              },
            });

            await this.mailService.sendPaymentFailedRecoveryEmail({
              toEmail: org.billingEmail || undefined,
              orgName: org.name,
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          await this.syncPlanFromSubscription(
            subscription,
            event.id,
            event.type,
          );
        } else {
          const customerId =
            typeof invoice.customer === 'string'
              ? invoice.customer
              : invoice.customer?.id;

          if (customerId) {
            const org = await this.prisma.organization.findFirst({
              where: { stripeCustomerId: customerId },
              select: { id: true, plan: true },
            });

            if (org) {
              const periodEnd = invoice.lines?.data?.[0]?.period?.end;
              const nextExpiresAt = periodEnd
                ? new Date(periodEnd * 1000)
                : null;

              if (nextExpiresAt) {
                await this.prisma.organization.update({
                  where: { id: org.id },
                  data: { planExpiresAt: nextExpiresAt },
                });
              }

              await this.createSubscriptionEventRecord({
                stripeEventId: event.id,
                eventType: event.type,
                orgId: org.id,
                previousPlan: org.plan as PlanKey,
                newPlan: org.plan as PlanKey,
                metadata: {
                  invoiceId: invoice.id,
                  amountPaid: invoice.amount_paid,
                  currency: invoice.currency,
                  periodEnd,
                },
              });

              await this.invalidateOrgCaches(org.id);
            }
          }
        }
        break;
      }

      default: {
        const customerFromEvent = (() => {
          const customer = event.data.object?.customer;
          if (!customer) return null;
          return typeof customer === 'string' ? customer : customer.id || null;
        })();

        if (customerFromEvent) {
          const org = await this.prisma.organization.findFirst({
            where: { stripeCustomerId: customerFromEvent },
            select: { id: true, plan: true },
          });

          if (org) {
            await this.createSubscriptionEventRecord({
              stripeEventId: event.id,
              eventType: event.type,
              orgId: org.id,
              previousPlan: org.plan as PlanKey,
              newPlan: org.plan as PlanKey,
              metadata: { ignored: true },
            });
          }
        }
      }
    }

    return {
      received: true,
      deduplicated: false,
      eventType: event.type,
    };
  }

  async getUsage(input: { orgId?: string | null; userId?: string | null }) {
    const orgId = String(input.orgId || '').trim();
    const userId = String(input.userId || '').trim();

    if (!orgId) {
      if (!userId) {
        throw new BadRequestException('User context required');
      }

      return {
        orgId: null,
        plan: 'FREE',
        limits: getEffectivePlanLimits('FREE'),
        features: PLAN_FEATURES.FREE,
        usage: await this.quotaService.getPersonalUsage(userId),
        billing: {
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          planExpiresAt: null,
          billingEmail: null,
        },
      };
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        plan: true,
        features: true,
        studentCount: true,
        courseCount: true,
        storageUsedMb: true,
        teacherSeatCount: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        planExpiresAt: true,
        billingEmail: true,
      },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    let billingEmail = org.billingEmail;
    let planExpiresAt = org.planExpiresAt;
    let stripeSubscriptionId = org.stripeSubscriptionId;
    let stripePriceId = org.stripePriceId;

    if (org.stripeCustomerId) {
      try {
        const stripe = this.getStripeClient();

        const customer = await stripe.customers.retrieve(org.stripeCustomerId);
        const customerEmail =
          customer && !customer.deleted && typeof customer.email === 'string'
            ? String(customer.email).trim()
            : '';

        if (customerEmail) {
          billingEmail = customerEmail;
        }

        let effectiveSubscriptionId = stripeSubscriptionId;
        let activeSubscription: any = null;

        if (effectiveSubscriptionId) {
          try {
            const currentSub = await stripe.subscriptions.retrieve(
              effectiveSubscriptionId,
            );
            if (
              currentSub &&
              ['active', 'trialing', 'past_due', 'unpaid'].includes(
                String(currentSub.status),
              )
            ) {
              activeSubscription = currentSub;
            }
          } catch {
            activeSubscription = null;
          }
        }

        if (!activeSubscription) {
          const listed = await stripe.subscriptions.list({
            customer: org.stripeCustomerId,
            status: 'all',
            limit: 20,
          });

          const preferred =
            (listed.data || []).find((sub: any) =>
              ['active', 'trialing'].includes(String(sub.status)),
            ) ||
            (listed.data || []).find((sub: any) =>
              ['past_due', 'unpaid'].includes(String(sub.status)),
            ) ||
            null;

          if (preferred) {
            activeSubscription = preferred;
            effectiveSubscriptionId = preferred.id;
          }
        }

        if (activeSubscription) {
          const periodEnd = Number(activeSubscription.current_period_end || 0);
          if (periodEnd > 0) {
            planExpiresAt = new Date(periodEnd * 1000);
          }

          const latestPriceId =
            activeSubscription.items?.data?.[0]?.price?.id ||
            stripePriceId ||
            null;
          stripePriceId = latestPriceId;
          stripeSubscriptionId =
            effectiveSubscriptionId || activeSubscription.id;
        }

        const needsPersist =
          (billingEmail || null) !== (org.billingEmail || null) ||
          (planExpiresAt?.getTime?.() || null) !==
            (org.planExpiresAt?.getTime?.() || null) ||
          (stripeSubscriptionId || null) !==
            (org.stripeSubscriptionId || null) ||
          (stripePriceId || null) !== (org.stripePriceId || null);

        if (needsPersist) {
          await this.prisma.organization.update({
            where: { id: org.id },
            data: {
              billingEmail: billingEmail || null,
              planExpiresAt: planExpiresAt || null,
              stripeSubscriptionId: stripeSubscriptionId || null,
              stripePriceId: stripePriceId || null,
            },
          });
        }
      } catch (error: any) {
        this.logger.warn(
          `Unable to hydrate live billing details for org ${org.id}: ${String(error?.message || 'unknown_error')}`,
        );
      }
    }

    const plan = (org.plan as PlanKey) || 'FREE';
    const baseFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.FREE;
    const overrides =
      org.features &&
      typeof org.features === 'object' &&
      !Array.isArray(org.features)
        ? (org.features as Record<string, unknown>)
        : {};
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const [adminSeats, teacherSeats, monthlyExams] = await Promise.all([
      this.prisma.user.count({ where: { orgId, role: 'ADMIN' } }),
      this.prisma.user.count({ where: { orgId, role: 'TEACHER' } }),
      this.prisma.usageLedger.count({
        where: {
          orgId,
          eventType: 'exam.created',
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      orgId: org.id,
      plan,
      limits: getEffectivePlanLimits(plan, org.features),
      features: {
        ...baseFeatures,
        ...overrides,
      },
      usage: {
        students: org.studentCount,
        courses: org.courseCount,
        storageMb: org.storageUsedMb,
        seats: adminSeats + teacherSeats,
        adminSeats,
        teacherSeats,
        monthlyExams,
      },
      billing: {
        stripeCustomerId: org.stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
        planExpiresAt,
        billingEmail,
      },
    };
  }

  getPlans() {
    const plans = PLANS.map((plan) => {
      const envMappedPrimary = PLAN_PRICE_MAP[plan]
        ? String(this.configService.get(PLAN_PRICE_MAP[plan]) || '').trim() ||
          null
        : null;

      const configuredIds = this.getPriceIdsFromEnv(plan);

      return {
        plan,
        limits: PLAN_LIMITS[plan],
        features: PLAN_FEATURES[plan],
        prices: {
          primary: envMappedPrimary,
          all: configuredIds,
        },
      };
    });

    return { plans };
  }
}
