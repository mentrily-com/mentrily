import { BillingService } from './billing.service';

describe('BillingService webhook handling', () => {
  let prisma: any;
  let stripe: any;
  let service: BillingService;

  const deliver = (event: any) => {
    stripe.webhooks.constructEvent.mockReturnValue(event);
    return service.handleWebhookEvent(Buffer.from('{}'), 'sig');
  };
  const updatedEvent = {
    id: 'evt_late',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_old',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_pro' } }] },
      },
    },
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'org_1',
          plan: 'FREE',
          stripeSubscriptionId: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscriptionEvent: {
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
    };
    stripe = {
      webhooks: { constructEvent: jest.fn() },
      subscriptions: { retrieve: jest.fn() },
    };
    service = new BillingService(
      {
        get: (k: string) => (k === 'STRIPE_WEBHOOK_SECRET' ? 'whsec' : ''),
      } as any,
      { legacyPrisma: prisma } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        del: jest.fn(),
        scan: jest.fn().mockResolvedValue(['0', []]),
        mget: jest.fn(),
      } as any,
      {} as any,
    );
    (service as any).stripe = stripe;
  });

  it('ignores a late subscription.updated when the live subscription is canceled', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      ...updatedEvent.data.object,
      status: 'canceled',
    });
    await deliver(updatedEvent);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_old');
    expect(prisma.organization.update).not.toHaveBeenCalled();
    expect(
      prisma.subscriptionEvent.upsert.mock.calls[0][0].update.metadata,
    ).toMatchObject({
      ignored: true,
    });
  });

  it('ignores subscription.updated for a subscription that is not the org current one', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'org_1',
      plan: 'PRO',
      stripeSubscriptionId: 'sub_new',
    });
    stripe.subscriptions.retrieve.mockResolvedValue(updatedEvent.data.object);
    await deliver(updatedEvent);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('applies the live subscription (not the event snapshot) when current', async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      ...updatedEvent.data.object,
      status: 'past_due',
    });
    await deliver(updatedEvent);
    expect(prisma.organization.update.mock.calls[0][0].data).toMatchObject({
      planStatus: 'PAST_DUE',
      stripeSubscriptionId: 'sub_old',
    });
  });

  it('treats a unique violation on the claim insert as already processed', async () => {
    prisma.subscriptionEvent.create.mockRejectedValue({ code: 'P2002' });
    const res = await deliver(updatedEvent);
    expect(res.deduplicated).toBe(true);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('releases the claim when processing fails so Stripe can retry', async () => {
    stripe.subscriptions.retrieve.mockRejectedValue(new Error('stripe down'));
    await expect(deliver(updatedEvent)).rejects.toThrow('stripe down');
    expect(prisma.subscriptionEvent.deleteMany).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_late' },
    });
  });
});
