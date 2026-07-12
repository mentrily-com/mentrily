import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/user.decorator';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async presign(@User() user: any, @Body() body: PresignUploadDto) {
    return this.uploadsService.presign(user, body);
  }

  @Post('confirm')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async confirm(@User() user: any, @Body() body: ConfirmUploadDto) {
    return this.uploadsService.confirm(user, body);
  }
}
