import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgFeaturesGuard } from '../auth/guards/org-features.guard';
import { OrgStatusGuard } from '../auth/guards/org-status.guard';
import { RequireOrgFeature } from '../auth/org-feature.decorator';
import { User } from '../auth/user.decorator';
import { SendExamInviteDto } from './dto/send-exam-invite.dto';
import { CourseMutationDto } from './dto/course-mutation.dto';
import { ExamMutationDto } from './dto/exam-mutation.dto';

@Controller('teacher')
@UseGuards(JwtAuthGuard, OrgStatusGuard)
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('stats')
  async getStats(@User() user: any) {
    return this.teacherService.getStats(user);
  }

  @Get('modules')
  async getMyModules(@User() user: any) {
    return this.teacherService.getMyModules(user);
  }

  @Get('submissions/recent')
  async getRecentSubmissions(@User() user: any) {
    return this.teacherService.getRecentSubmissions(user);
  }

  @Get('activity/recent')
  async getRecentActivity(@User() user: any) {
    return this.teacherService.getRecentActivity(user);
  }

  @Get('students')
  async getStudents(
    @User() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.teacherService.getStudents(user, { limit, offset });
  }

  @Get('students/:studentId/analytics')
  async getStudentAnalytics(
    @Param('studentId') studentId: string,
    @User() user: any,
  ) {
    return this.teacherService.getStudentAnalytics(studentId, user);
  }

  @Get('students/:studentId/attempts')
  async getStudentAttempts(
    @Param('studentId') studentId: string,
    @User() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.teacherService.getStudentAttempts(studentId, user, {
      limit,
      offset,
    });
  }

  @Get('students/:studentId/unit-submissions')
  async getStudentUnitSubmissions(
    @Param('studentId') studentId: string,
    @User() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.teacherService.getStudentUnitSubmissions(studentId, user, {
      limit,
      offset,
    });
  }

  @Post('courses/:courseId/enroll/:studentId')
  async enrollStudent(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
    @User() user: any,
  ) {
    return this.teacherService.enrollStudent(courseId, studentId, user);
  }

  @Delete('courses/:courseId/enroll/:studentId')
  async unenrollStudent(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
    @User() user: any,
  ) {
    console.log('Unenroll request:', { courseId, studentId, userId: user.id });
    return this.teacherService.unenrollStudent(courseId, studentId, user);
  }

  @Post('courses/:courseId/enroll')
  async enrollByEmails(
    @Param('courseId') courseId: string,
    @Body() data: { emails: string[] },
    @User() user: any,
  ) {
    return this.teacherService.enrollByEmails(courseId, data.emails, user);
  }

  @Get('exams/:examId/submissions/:identifier')
  async getSubmission(
    @Param('examId') examId: string,
    @Param('identifier') identifier: string,
    @User() user: any,
  ) {
    return this.teacherService.getSubmission(examId, identifier, user);
  }

  @Get('courses')
  async getCourses(@User() user: any) {
    return this.teacherService.getCourses(user);
  }

  @Get('courses/:idOrSlug')
  async getCourse(@Param('idOrSlug') idOrSlug: string, @User() user: any) {
    return this.teacherService.getCourse(idOrSlug, user);
  }

  @Post('courses')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateCourses')
  async createCourse(
    @Body(new ValidationPipe({ transform: true, whitelist: false }))
    data: CourseMutationDto,
    @User() user: any,
  ) {
    return this.teacherService.createCourse(user, data);
  }

  @Put('courses/:id')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateCourses')
  async updateCourse(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: false }))
    data: CourseMutationDto,
    @User() user: any,
  ) {
    return this.teacherService.updateCourse(id, user, data);
  }

  @Delete('courses/:id')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateCourses')
  async deleteCourse(@Param('id') id: string, @User() user: any) {
    try {
      return await this.teacherService.deleteCourse(id, user);
    } catch (e) {
      console.error(`[TeacherController] Delete Course Failed:`, e);
      throw new BadRequestException(e.message || 'Failed to delete course');
    }
  }

  @Post('courses/:id/link-exam')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateExams')
  async linkExamToCourse(
    @Param('id') id: string,
    @Body()
    data: {
      examId: string;
      examPassThreshold?: number;
      examUnlockThreshold?: number;
      passingPercentage?: number;
      maxAttempts?: number;
      attemptBufferMins?: number;
    },
    @User() user: any,
  ) {
    return this.teacherService.linkExamToCourse(
      id,
      data.examId,
      user,
      {
        examPassThreshold: data.examPassThreshold,
        examUnlockThreshold: data.examUnlockThreshold,
        passingPercentage: data.passingPercentage,
        maxAttempts: data.maxAttempts,
        attemptBufferMins: data.attemptBufferMins,
      },
    );
  }

  @Delete('courses/:id/unlink-exam')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateExams')
  async unlinkExamFromCourse(@Param('id') id: string, @User() user: any) {
    return this.teacherService.unlinkExamFromCourse(id, user);
  }

  @Get('exams')
  async getExams(@User() user: any) {
    return this.teacherService.getExams(user);
  }

  @Get('exams/scheduled')
  async getScheduledExams(@User() user: any) {
    return this.teacherService.getScheduledExams(user);
  }

  @Get('exams/:idOrSlug')
  async getExam(@Param('idOrSlug') idOrSlug: string, @User() user: any) {
    return this.teacherService.getExam(idOrSlug, user);
  }

  @Post('exams')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateExams')
  async createExam(
    @Body(new ValidationPipe({ transform: true, whitelist: false }))
    data: ExamMutationDto,
    @User() user: any,
  ) {
    return this.teacherService.createExam(user, data);
  }

  @Put('exams/:id')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateExams')
  async updateExam(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: false }))
    data: ExamMutationDto,
    @User() user: any,
  ) {
    return this.teacherService.updateExam(id, user, data);
  }

  @Delete('exams/:id')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canCreateExams')
  async deleteExam(@Param('id') id: string, @User() user: any) {
    try {
      return await this.teacherService.deleteExam(id, user);
    } catch (e) {
      console.error(`[TeacherController] Delete Exam Failed:`, e);
      throw new BadRequestException(e.message || 'Failed to delete exam');
    }
  }

  @Get('exams/:examId/monitor')
  async getMonitoredStudents(
    @Param('examId') examId: string,
    @User() user: any,
  ) {
    return this.teacherService.getMonitoredStudents(examId, user);
  }

  @Get('exams/:examId/results')
  async getExamResults(
    @Param('examId') examId: string,
    @User() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search: string = '',
  ) {
    return this.teacherService.getExamResults(
      examId,
      user,
      Number(page),
      Number(limit),
      search,
    );
  }

  @Put('exams/:examId/submissions/:sessionId/score')
  async updateSubmissionScore(
    @Param('sessionId') sessionId: string,
    @Body() data: { score: number; internalMarks?: Record<string, number> },
    @User() user: any,
  ) {
    return this.teacherService.updateSubmissionScore(
      sessionId,
      data.score,
      user,
      data.internalMarks,
    );
  }

  @Post('exams/:examId/publish')
  async publishResults(@Param('examId') examId: string, @User() user: any) {
    return this.teacherService.publishResults(examId, user);
  }

  @Get('exams/:examId/feedbacks')
  async getFeedbacks(@Param('examId') examId: string, @User() user: any) {
    return this.teacherService.getFeedbacks(examId, user);
  }

  @Post('exams/:examId/terminate/:userId')
  async terminateExamSession(
    @Param('examId') examId: string,
    @Param('userId') userId: string,
    @User() user: any,
  ) {
    return this.teacherService.terminateExamSession(examId, userId, user);
  }

  @Post('exams/:examId/unterminate/:userId')
  async unterminateExamSession(
    @Param('examId') examId: string,
    @Param('userId') userId: string,
    @User() user: any,
  ) {
    return this.teacherService.unterminateExamSession(examId, userId, user);
  }

  @Post('exams/:examId/invite')
  async sendExamInvites(
    @Param('examId') examId: string,
    @Body() data: SendExamInviteDto,
    @User() user: any,
  ) {
    return this.teacherService.sendExamInvites(examId, data, user);
  }

  // ─── GROUPS ────────────────────────────────────────────────────────────────

  @Get('groups')
  async getGroups(@User() user: any) {
    return this.teacherService.getGroups(user);
  }

  @Get('groups/:id')
  async getGroup(@Param('id') id: string, @User() user: any) {
    return this.teacherService.getGroup(id, user);
  }

  @Post('groups')
  async createGroup(
    @Body() data: { name: string; emails?: string[] },
    @User() user: any,
  ) {
    return this.teacherService.createGroup(user, data);
  }

  @Put('groups/:id')
  async updateGroup(
    @Param('id') id: string,
    @Body() data: { name: string },
    @User() user: any,
  ) {
    return this.teacherService.updateGroup(id, user, data);
  }

  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string, @User() user: any) {
    return this.teacherService.deleteGroup(id, user);
  }

  @Post('groups/:id/students')
  async addGroupStudents(
    @Param('id') id: string,
    @Body() data: { emails: string[] },
    @User() user: any,
  ) {
    return this.teacherService.addGroupStudents(id, data.emails, user);
  }

  @Delete('groups/:id/students/:studentId')
  async removeGroupStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @User() user: any,
  ) {
    return this.teacherService.removeGroupStudent(id, studentId, user);
  }

  @Post('courses/:courseId/enroll-group/:groupId')
  async enrollGroupInCourse(
    @Param('courseId') courseId: string,
    @Param('groupId') groupId: string,
    @User() user: any,
  ) {
    return this.teacherService.enrollGroupInCourse(courseId, groupId, user);
  }

  // ─── ANNOUNCEMENTS ─────────────────────────────────────────────────────────

  @Get('announcements')
  async getAnnouncements(@User() user: any) {
    return this.teacherService.getAnnouncements(user);
  }

  @Post('announcements')
  async createAnnouncement(
    @Body()
    data: {
      title: string;
      content: string;
      groupIds: string[];
      attachments?: any[];
    },
    @User() user: any,
  ) {
    return this.teacherService.createAnnouncement(user, data);
  }

  @Put('announcements/:id')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body()
    data: {
      title: string;
      content: string;
      groupIds: string[];
      attachments?: any[];
    },
    @User() user: any,
  ) {
    return this.teacherService.updateAnnouncement(id, user, data);
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(@Param('id') id: string, @User() user: any) {
    return this.teacherService.deleteAnnouncement(id, user);
  }

}
