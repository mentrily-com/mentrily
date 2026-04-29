import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  private getTimePayload() {
    const now = new Date();
    const kathmanduLocal = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Kathmandu',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .format(now)
      .replace(' ', 'T');

    return {
      serverTimeMs: now.getTime(),
      serverTimeIso: now.toISOString(),
      timeZone: 'Asia/Kathmandu',
      kathmanduLocal,
      utcOffsetMinutes: 345,
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
  async getHealth() {
    return this.appService.getHealth();
  }
}
