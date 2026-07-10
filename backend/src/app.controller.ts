import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  private getTimePayload() {
    const now = new Date();
    // UTC reference clock (was hardcoded to Asia/Kathmandu). serverTimeMs is the
    // absolute instant clients use; per-exam display zones live on Exam.timeZone.
    return {
      serverTimeMs: now.getTime(),
      serverTimeIso: now.toISOString(),
      timeZone: 'UTC',
      utcOffsetMinutes: 0,
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('time')
  getServerTime() {
    return this.getTimePayload();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  async getReady() {
    return this.appService.getReady();
  }
}
