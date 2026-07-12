import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Header,
  BadRequestException,
  ForbiddenException,
  Body,
} from '@nestjs/common';
import { CourseService } from './course.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/user.decorator';
import { StorageService } from '../../services/storage/storage.service';

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

  @Delete('video')
  async deleteCourseVideo(@Body() body: { url: string }, @User() user: any) {
    if (!body?.url) {
      throw new BadRequestException('Video URL is required');
    }

    // body.url is client-supplied — never trust it as proof of ownership.
    // Only allow deleting a video uploaded under the caller's own org or
    // personal namespace (see uploadCourseVideo/StorageService.uploadFile).
    const allowedNamespaces = [
      user?.orgId,
      user?.id ? `user-${user.id}` : null,
    ];
    if (!this.storageService.isOwnedByNamespace(body.url, allowedNamespaces)) {
      throw new ForbiddenException('You do not have access to this file');
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
