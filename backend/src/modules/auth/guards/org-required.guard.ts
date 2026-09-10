import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORG_REQUIRED_KEY } from '../org-required.decorator';

@Injectable()
export class OrgRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      ORG_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (user?.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!String(user?.orgId || '').trim()) {
      throw new ForbiddenException('Organization context required');
    }

    return true;
  }
}
