import { Module } from '@nestjs/common';
import { CourseController, PublicCourseController } from './course.controller';
import { CourseService } from './course.service';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { StorageModule } from '../../services/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [CourseController, PublicCourseController],
  providers: [CourseService],
  exports: [CourseService],
})
export class CourseModule {}
