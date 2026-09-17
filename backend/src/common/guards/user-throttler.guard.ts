import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.DISABLE_THROTTLER === 'true') {
      return true;
    }
    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    let tracker = req.ips?.length ? req.ips[0] : req.ip;

    // 1. If user is already authenticated by an earlier guard
    if (req.user?.id) {
      tracker = `user:${req.user.id}`;
    } else {
      // 2. Fastify lowercases headers: req.headers['authorization']
      const authHeader = req.headers?.authorization;
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token) {
          tracker = `token:${token.slice(-40)}`;
        }
      } else {
        // 3. Check Clerk session cookie from req.cookies or raw cookie header
        const sessionCookie =
          req.cookies?.__session ||
          (typeof req.headers?.cookie === 'string'
            ? req.headers.cookie.match(/__session=([^;]+)/)?.[1]
            : undefined);

        if (sessionCookie && typeof sessionCookie === 'string' && sessionCookie.trim()) {
          tracker = `cookie:${sessionCookie.trim().slice(-40)}`;
        } else {
          const rawIp = req.ips?.length ? req.ips[0] : req.ip || 'unknown-ip';
          const deviceId = req.body?.deviceId || req.headers?.['x-device-id'];
          if (deviceId) {
            tracker = `ip-device:${rawIp}:${deviceId}`;
          } else {
            tracker = `ip:${rawIp}`;
          }
        }
      }
    }

    return tracker;
  }
}
