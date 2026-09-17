import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonitoringGateway } from './monitoring.gateway';

@Controller('exam/monitoring')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class MonitoringController {
  constructor(private gateway: MonitoringGateway) {}

  @Post('log-event')
  logEvent(@Body() body: any) {
    // In real implementation, save to Redis stream
    console.log('Event Logged:', body);
    return { status: 'logged' };
  }

  @Post('log-violation')
  logViolation(@Body() body: { violationType?: string; examId?: string }) {
    // WARNING: this endpoint does NOT persist anything. Violations are
    // recorded by the 'log_violation' socket event (monitoring.gateway),
    // which is the only path that verifies session ownership, counts tab
    // switches and enforces the limit. Anything sent here is dropped, so
    // never route real proctoring events through it.
    console.warn(
      '[Monitoring] HTTP log-violation received but NOT persisted (socket is the source of truth):',
      { type: body?.violationType, examId: body?.examId },
    );

    // NOTE: Real-time proctoring primarily uses handleLogViolation in monitoring.gateway.ts
    // We comment this out to prevent double-counting in the monitoring dashboard
    /*
        this.gateway.server
            .to(`exam_${body.examId}_monitor`)
            .emit('live_violation', body);
        */

    return { status: 'not_persisted' };
  }

  @Post('heartbeat')
  heartbeat(@Body() body: any) {
    // Just return success for liveness check
    return { status: 'alive', timestamp: new Date() };
  }
}
