import {
  Controller,
  Request,
  Post,
  Patch,
  Delete,
  UseGuards,
  Body,
  Get,
  UnauthorizedException,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from './user.decorator';
import { SelectRoleDto } from './dto/select-role.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import type { FastifyRequest } from 'fastify';
import { MembershipService } from '../organization/membership.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';
import { Webhook } from 'svix';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private membershipService: MembershipService,
    private orgProvisioningService: OrgProvisioningService,
  ) {}

  @Post('webhooks/clerk')
  @SkipThrottle()
  async handleClerkWebhook(@Req() req: FastifyRequest) {
    const webhookSecret = this.configService.get<string>(
      'CLERK_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new UnauthorizedException('Missing CLERK_WEBHOOK_SECRET');
    }

    const svixId = String(req.headers['svix-id'] || '');
    const svixTimestamp = String(req.headers['svix-timestamp'] || '');
    const svixSignature = String(req.headers['svix-signature'] || '');

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    const rawBody = (req as any).rawBody;
    const payload = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : typeof rawBody === 'string'
        ? rawBody
        : JSON.stringify((req as any).body || {});

    let event: any;
    try {
      const wh = new Webhook(webhookSecret);
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (error: any) {
      this.logger.warn(
        `Clerk webhook verification failed: ${String(error?.message || 'unknown_error')}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.authService.syncClerkUser(event.type, event.data);
    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('exam-login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async examLogin(
    @Body() data: { testCode: string; slug?: string },
    @Req() req: any,
  ) {
    return this.authService.examLogin(
      req.user.id,
      data.testCode,
      data.slug,
      {
        userAgent: req?.headers?.['user-agent'],
        clientPlatform: req?.headers?.['x-client-platform'],
      },
    );
  }

  @Post('exam-login/verify-code')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async verifyExamCode(@Body() data: { testCode: string; slug?: string }) {
    return this.authService.verifyExamTestCode(data.testCode, data.slug);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-role')
  async selectRole(@User() user: any, @Body() body: SelectRoleDto) {
    return this.authService.selectRole(user.id, body.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-role-creator')
  async selectRoleCreator(@User() user: any) {
    return this.authService.selectRoleCreator(user.id);
  }

  // Workspace switching — every org a user belongs to (their home org plus
  // any they've been invited into since), and switching which one is
  // active. Switching never touches the user's home org/role; it only
  // changes which membership the NEXT request resolves against (the client
  // sends X-Active-Org-Id and refetches /auth/me after calling this).
  @UseGuards(JwtAuthGuard)
  @Get('memberships')
  async listMemberships(@User() user: any) {
    return this.membershipService.listMemberships(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-org')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async switchOrg(@User() user: any, @Body() body: SwitchOrgDto) {
    const resolved = await this.membershipService.switchActiveOrg(
      user,
      body.orgId,
    );
    // lastActiveOrgId changed — cached sessions (especially the header-less
    // 'default' scope) would keep resolving the previous org until TTL.
    await this.authService.clearSessionCache(user.id, user.clerkId);
    return resolved;
  }

  // Return to the home (Learner) persona. Separate from switch-org because a
  // learner's home can be org-less, which switch-org can't target.
  @UseGuards(JwtAuthGuard)
  @Post('switch-home')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async switchHome(@User() user: any) {
    const resolved = await this.membershipService.switchToHome(user.id);
    await this.authService.clearSessionCache(user.id, user.clerkId);
    return resolved;
  }

  // Self-serve Creator persona: adds a Teacher membership on the user's own
  // personal org without ever touching their existing home org/role (e.g. a
  // Learner keeps their Learner data untouched). Idempotent — a user only
  // ever owns one personal org, so repeat calls just return it.
  @UseGuards(JwtAuthGuard)
  @Post('become-creator')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async becomeCreator(@User() user: any) {
    if (user.role === 'SUPER_ADMIN') {
      throw new BadRequestException('Not available for this account');
    }

    const persona = await this.orgProvisioningService.ensureCreatorPersona(
      user.id,
    );
    await this.authService.clearSessionCache(user.id, user.clerkId);
    return persona;
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/complete')
  async completeOnboarding(@User() user: any) {
    return this.authService.completeOnboarding(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@User() user: any, @Body() body: { name?: string }) {
    return this.authService.updateProfile(user.id, { name: body?.name });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('profile/picture')
  async removeProfilePicture(@User() user: any) {
    return this.authService.removeProfilePicture(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bug-reports')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createBugReport(
    @User() user: any,
    @Body()
    body: {
      title: string;
      description: string;
      attachments?: { name: string; url: string; type: string; size: number }[];
    },
  ) {
    return this.authService.createBugReport(user, body);
  }
}
