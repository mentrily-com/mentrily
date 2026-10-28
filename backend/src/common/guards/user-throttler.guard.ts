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
    // This guard runs before auth, so bearer tokens, cookies and device ids are
    // unverified and attacker-chosen; only a verified user or the client IP may key a bucket.
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Fastify's req.ip already honours trustProxy; req.ips[0] is the nearest hop, not the client.
    return `ip:${req.ip || 'unknown-ip'}`;
  }
}
