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
import { StorageService } from '../../services/storage/storage.service';
import { MembershipService } from '../organization/membership.service';
import { OrgProvisioningService } from '../organization/org-provisioning.service';
import { Webhook } from 'svix';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BUG_ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
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
    return this.authService.examLogin(req.user.id, data.testCode, data.slug, {
      userAgent: req?.headers?.['user-agent'],
      clientPlatform: req?.headers?.['x-client-platform'],
    });
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
    return this.membershipService.switchActiveOrg(user, body.orgId);
  }

  // Return to the home (Learner) persona. Separate from switch-org because a
  // learner's home can be org-less, which switch-org can't target.
  @UseGuards(JwtAuthGuard)
  @Post('switch-home')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async switchHome(@User() user: any) {
    return this.membershipService.switchToHome(user.id);
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

    return this.orgProvisioningService.ensureCreatorPersona(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/complete')
  async completeOnboarding(@User() user: any) {
    return this.authService.completeOnboarding(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  async uploadAvatar(@User() user: any, @Req() req: FastifyRequest) {
    const multipartReq = req as any;

    if (!multipartReq.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const parts = multipartReq.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'avatar') {
        const buffer = await part.toBuffer();

        if (buffer.length > MAX_FILE_SIZE) {
          throw new BadRequestException('File size must be less than 5MB');
        }
        if (!ALLOWED_IMAGE_TYPES.includes(part.mimetype)) {
          throw new BadRequestException(
            'Only image files are allowed (JPEG, PNG, GIF, WebP)',
          );
        }

        const url = await this.storageService.uploadFile(
          buffer,
          part.filename,
          part.mimetype,
          'avatars',
          buffer.length,
          user?.orgId,
        );
        return this.authService.updateProfile(user.id, { profilePicture: url });
      } else if (part.type === 'file') {
        await part.toBuffer();
      }
    }

    throw new BadRequestException('No avatar file provided');
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
  @Post('bug-reports/upload-image')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async uploadBugReportImage(@User() user: any, @Req() req: FastifyRequest) {
    const multipartReq = req as any;

    if (!multipartReq.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const parts = multipartReq.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        const buffer = await part.toBuffer();

        if (buffer.length > MAX_FILE_SIZE) {
          throw new BadRequestException('Each image must be less than 5MB');
        }
        if (!BUG_ALLOWED_IMAGE_TYPES.includes(part.mimetype)) {
          throw new BadRequestException(
            'Only image files are allowed (JPEG, PNG, WebP, GIF)',
          );
        }

        const uploaded = await this.authService.uploadBugReportImage(
          user,
          buffer,
          part.filename,
          part.mimetype,
          buffer.length,
        );
        return uploaded;
      } else if (part.type === 'file') {
        await part.toBuffer();
      }
    }

    throw new BadRequestException('No image file provided');
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
