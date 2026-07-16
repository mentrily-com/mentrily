import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { AdminService } from './admin.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { QuotaService } from '../billing/quota.service';
import { MailService } from '../../services/mail.service';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

const clerkInvite = jest.fn();
const clerkRevoke = jest.fn();

describe('AdminService invite flow', () => {
  let service: AdminService;
  let prisma: any;
  let quotaService: any;

  beforeEach(async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_mock';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.APP_URL = 'https://mentrily.com';
    clerkInvite.mockReset().mockResolvedValue({ id: 'inv_123' });
    clerkRevoke.mockReset().mockResolvedValue({ id: 'inv_old' });
    (createClerkClient as jest.Mock).mockReturnValue({
      invitations: {
        createInvitation: clerkInvite,
        revokeInvitation: clerkRevoke,
      },
    });

    prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'org_1',
          plan: 'ENTERPRISE',
          features: {},
          domain: 'school.example.com',
          maxUsers: 100,
          maxAdminSeats: null,
          _count: { users: 0 },
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      orgMembership: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      pendingInvite: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'pending_1' }),
        update: jest.fn().mockResolvedValue({ id: 'pending_1' }),
        delete: jest.fn().mockResolvedValue({ id: 'pending_1' }),
      },
    };

    quotaService = {
      checkStudentQuota: jest.fn().mockResolvedValue(undefined),
      checkTeacherSeatQuota: jest.fn().mockResolvedValue(undefined),
      checkAdminSeatQuota: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: prisma,
          },
        },
        { provide: QuotaService, useValue: quotaService },
        {
          provide: MailService,
          useValue: { sendOrgInviteEmail: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            scan: jest.fn().mockResolvedValue(['0', []]),
            mget: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('sends a Clerk invite and stores pending invite metadata', async () => {
    const result = await service.inviteUser(
      {
        email: 'NewUser@Example.com',
        name: 'New User',
        role: 'TEACHER',
        dept: 'CS',
        id: 'T-1',
      },
      { id: 'admin_1', role: 'ADMIN', orgId: 'org_1' },
    );

    expect(result).toMatchObject({
      invited: true,
      email: 'newuser@example.com',
      role: 'TEACHER',
    });
    expect(quotaService.checkTeacherSeatQuota).toHaveBeenCalledWith(
      'org_1',
      1,
    );
    expect(prisma.pendingInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'newuser@example.com',
        role: 'TEACHER',
        orgId: 'org_1',
        name: 'New User',
        department: 'CS',
        rollNumber: 'T-1',
      }),
    });
    expect(clerkInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: 'newuser@example.com',
        redirectUrl: 'https://school.example.com/signup',
        notify: true,
        expiresInDays: 7,
        publicMetadata: expect.objectContaining({
          appRole: 'TEACHER',
          orgId: 'org_1',
        }),
      }),
    );
  });

  it('rejects existing application users who are already a member of this org', async () => {
    // Being an existing user elsewhere no longer blocks an invite on its
    // own (a person can hold a Learner persona in one org and be invited
    // as Teacher in another) — only membership in THIS specific org does.
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      orgId: 'org_1',
    });

    await expect(
      service.inviteUser(
        { email: 'taken@example.com', role: 'STUDENT' },
        { role: 'ADMIN', orgId: 'org_1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(clerkInvite).not.toHaveBeenCalled();
  });

  it('invites an existing user from another org (additive second-org membership)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      orgId: 'org_home',
    });

    const result = await service.inviteUser(
      { email: 'multi-org@example.com', role: 'STUDENT' },
      { role: 'ADMIN', orgId: 'org_1' },
    );

    expect(result).toMatchObject({ invited: true });
    expect(clerkInvite).toHaveBeenCalled();
  });

  it('returns success for active duplicate pending invites', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValueOnce({
      id: 'pending_old',
      email: 'dupe@example.com',
      role: 'ADMIN',
      orgId: 'org_1',
      clerkInvitationId: 'inv_old',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.inviteUser(
      { email: 'dupe@example.com', role: 'ADMIN' },
      { role: 'ADMIN', orgId: 'org_1' },
    );

    expect(result).toMatchObject({
      alreadyInvited: true,
      email: 'dupe@example.com',
    });
    expect(clerkInvite).not.toHaveBeenCalled();
  });

  it('replaces expired local invites before sending a new Clerk invite', async () => {
    prisma.pendingInvite.findUnique.mockResolvedValueOnce({
      id: 'pending_expired',
      email: 'expired@example.com',
      role: 'STUDENT',
      orgId: 'org_1',
      clerkInvitationId: 'inv_expired',
      expiresAt: new Date(Date.now() - 60_000),
    });

    await service.inviteUser(
      { email: 'expired@example.com', role: 'STUDENT' },
      { role: 'ADMIN', orgId: 'org_1' },
    );

    expect(clerkRevoke).toHaveBeenCalledWith('inv_expired');
    expect(prisma.pendingInvite.delete).toHaveBeenCalledWith({
      where: { id: 'pending_expired' },
    });
    expect(clerkInvite).toHaveBeenCalled();
  });

  it('summarizes mixed bulk invite results', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await service.inviteUsersBulk(
      [
        { email: 'one@example.com', role: 'USER' },
        { email: 'one@example.com', role: 'TEACHER' },
        { email: 'bad-email', role: 'ADMIN' },
      ],
      { role: 'ADMIN', orgId: 'org_1' },
    );

    expect(result.summary).toMatchObject({
      totalProcessed: 3,
      invited: 1,
      failed: 2,
      emailsSent: 1,
    });
  });

  it('falls back to the public app URL when FRONTEND_URL points to localhost', async () => {
    prisma.organization.findUnique.mockResolvedValueOnce({
      id: 'org_1',
      plan: 'ENTERPRISE',
      features: {},
      domain: null,
      maxUsers: 100,
      maxAdminSeats: null,
      _count: { users: 0 },
    });

    await service.inviteUser(
      { email: 'public-fallback@example.com', role: 'STUDENT' },
      { id: 'admin_1', role: 'ADMIN', orgId: 'org_1' },
    );

    expect(clerkInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: 'public-fallback@example.com',
        redirectUrl: 'https://mentrily.com/signup',
      }),
    );
  });
});
