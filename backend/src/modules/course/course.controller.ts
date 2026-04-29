import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Header,
  BadRequestException,
  Req,
  Body,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/user.decorator';
import { StorageService } from '../../services/storage/storage.service';
import type { FastifyRequest } from 'fastify';

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

@Controller('course')
@UseGuards(JwtAuthGuard)
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly storageService: StorageService,
  ) {}

  @Get(':slug')
  // Keep response non-cacheable at browser/CDN layer to avoid stale learner views after teacher updates.
  @Header('Cache-Control', 'no-store')
  async getCourse(@Param('slug') slug: string, @User() user: any) {
    return this.courseService.getCourse(slug, user);
  }

  @Get('unit/:id')
  async getUnit(@Param('id') id: string, @User() user: any) {
    return this.courseService.getUnit(id, user);
  }

  @Post('upload-video')
  async uploadCourseVideo(@User() user: any, @Req() req: FastifyRequest) {
    const multipartReq = req as any;

    if (!multipartReq.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const parts = multipartReq.parts();
    const fileSizeHeader = req.headers['x-file-size'];
    const fileSize = fileSizeHeader
      ? parseInt(fileSizeHeader as string, 10)
      : undefined;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'video') {
        if (!ALLOWED_VIDEO_TYPES.includes(part.mimetype)) {
          await part.toBuffer(); // consume unused file part
          throw new BadRequestException(
            'Only video files are allowed (MP4, WebM, OGG, MOV)',
          );
        }

        if (fileSize && fileSize > MAX_VIDEO_SIZE) {
          await part.toBuffer(); // consume
          throw new BadRequestException(
            'Video file size must be less than 500MB',
          );
        }

        // Use part.file (which is a Readable stream) to avoid loading the whole file into memory
        const url = await this.storageService.uploadFile(
          part.file,
          part.filename,
          part.mimetype,
          'courseVideos',
          fileSize,
          user?.orgId,
        );
        return { url };
      } else if (part.type === 'file') {
        await part.toBuffer(); // consume unused file parts
      }
    }

    throw new BadRequestException('No video file provided');
  }

  @Delete('video')
  async deleteCourseVideo(@Body() body: { url: string }, @User() user: any) {
    if (!body?.url) {
      throw new BadRequestException('Video URL is required');
    }
    await this.storageService.deleteFile(body.url, user?.orgId);
    return { success: true };
  }
}

@Controller('courses/public')
export class PublicCourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get(':orgSlug/:courseSlug')
  async getPublicCourse(
    @Param('orgSlug') orgSlug: string,
    @Param('courseSlug') courseSlug: string,
  ) {
    return this.courseService.getPublicCourse(orgSlug, courseSlug);
  }
}
