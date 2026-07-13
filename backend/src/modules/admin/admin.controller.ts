import {
  Controller,
  Get,
  UseGuards,
  Delete,
  Param,
  Patch,
  Post,
  Body,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgFeaturesGuard } from '../auth/guards/org-features.guard';
import { OrgStatusGuard } from '../auth/guards/org-status.guard';
import { OrgRequiredGuard } from '../auth/guards/org-required.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { RequirePlan } from '../auth/plan.decorator';
import { RequireOrgFeature } from '../auth/org-feature.decorator';
import { RequireOrg } from '../auth/org-required.decorator';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUsersBulkDto } from './dto/create-users-bulk.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, OrgRequiredGuard, OrgStatusGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@RequireOrg()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getGlobalStats(user, orgId);
  }

  @Get('users')
  async getUsers(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getUsers(user, orgId);
  }

  @Post('users')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canManageUsers')
  async createUser(
    @User() user: any,
    @Body() data: CreateUserDto,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.createUser(data, user, orgId);
  }

  @Post('users/bulk')
  @UseGuards(PlanGuard, OrgFeaturesGuard)
  @RequirePlan('bulkImport')
  @RequireOrgFeature('canManageUsers')
  async createUsersBulk(
    @User() user: any,
    @Body() data: CreateUsersBulkDto,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.createUsersBulk(data.users, user, orgId);
  }

  @Post('users/invite')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canManageUsers')
  async inviteUser(
    @User() user: any,
    @Body() data: InviteUserDto,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.inviteUser(data, user, orgId);
  }

  @Get('logs')
  async getLogs(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getSystemLogs(user, orgId);
  }

  @Get('analytics')
  async getAnalytics(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getAnalytics(user, orgId);
  }

  @Get('exams')
  async getExams(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getExams(user, orgId);
  }

  @Get('courses')
  async getCourses(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getCourses(user, orgId);
  }

  @Get('settings')
  async getOrganizationSettings(
    @User() user: any,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.getOrganizationSettings(user, orgId);
  }

  @Get('onboarding-status')
  async getOnboardingStatus(@User() user: any, @Query('orgId') orgId?: string) {
    return this.adminService.getOnboardingStatus(user, orgId);
  }

  @Patch('settings')
  async updateOrganizationSettings(
    @User() user: any,
    @Body() body: { features?: Record<string, unknown> },
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.updateOrganizationSettings(user, body, orgId);
  }

  @Patch('users/:id/status')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canManageUsers')
  async toggleUserStatus(
    @User() user: any,
    @Param('id') id: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.toggleUserStatus(id, user, orgId);
  }

  @Patch('users/:id/role')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canManageUsers')
  async updateUserRole(
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.updateUserRole(id, body.role, user, orgId);
  }

  @Delete('users/:id')
  @UseGuards(OrgFeaturesGuard)
  @RequireOrgFeature('canManageUsers')
  async deleteUser(
    @User() user: any,
    @Param('id') id: string,
    @Query('orgId') orgId?: string,
  ) {
    console.log('[AdminController] Deleting user:', id);
    return this.adminService.deleteUser(id, user, orgId);
  }

  @Get('courses/:courseId/assignments')
  async getCourseAssignments(
    @User() user: any,
    @Param('courseId') courseId: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.getCourseAssignments(courseId, user, orgId);
  }

  @Post('courses/:courseId/assignments')
  async assignTeacherToCourse(
    @User() user: any,
    @Param('courseId') courseId: string,
    @Body() body: { teacherId: string },
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.assignTeacherToCourse(
      courseId,
      body.teacherId,
      user,
      orgId,
    );
  }

  @Delete('courses/:courseId/assignments/:teacherId')
  async removeTeacherFromCourse(
    @User() user: any,
    @Param('courseId') courseId: string,
    @Param('teacherId') teacherId: string,
    @Query('orgId') orgId?: string,
  ) {
    return this.adminService.removeTeacherFromCourse(
      courseId,
      teacherId,
      user,
      orgId,
    );
  }
}
