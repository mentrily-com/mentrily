import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  UseGuards,
  Param,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import { StorageService } from '../../services/storage/storage.service';
import { UpdateOrganizationPlanDto } from './dto/update-organization-plan.dto';
import { UpdateOrganizationLimitsDto } from './dto/update-organization-limits.dto';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly storageService: StorageService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.superAdminService.getStats();
  }

  @Get('organizations')
  async getOrganizations() {
    return this.superAdminService.getOrganizations();
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id') id: string) {
    return this.superAdminService.getOrganization(id);
  }

  @Post('organizations')
  async createOrganization(@User() user: any, @Body() body: any) {
    if (body?.logo) {
      // logo is a URL from a direct-to-S3 upload (kind: 'org-logo',
      // namespaced under the calling admin's own user id since the org
      // doesn't exist yet) — verify this caller actually uploaded it.
      const allowedNamespaces = [user?.id ? `user-${user.id}` : null];
      if (
        !this.storageService.isOwnedByNamespace(body.logo, allowedNamespaces)
      ) {
        throw new ForbiddenException('You do not have access to this file');
      }
    }
    return this.superAdminService.createOrganization(body);
  }

  @Put('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @User() user: any,
    @Body() data: any,
  ) {
    if (data?.logo) {
      const existing = await this.superAdminService.getOrganization(id);
      if (existing?.logo !== data.logo) {
        // Allow the new upload (user-xxx) or the existing org namespace (id)
        const allowedNamespaces = [user?.id ? `user-${user.id}` : null, id];
        if (
          !this.storageService.isOwnedByNamespace(
            data.logo,
            allowedNamespaces,
            {
              allowUnnamespacedLegacy: true,
            },
          )
        ) {
          throw new ForbiddenException('You do not have access to this file');
        }
      }
    }
    return this.superAdminService.updateOrganization(id, data);
  }

  @Patch('organizations/:id/plan')
  async updateOrganizationPlan(
    @Param('id') id: string,
    @Body() data: UpdateOrganizationPlanDto,
    @Req() req: any,
  ) {
    return this.superAdminService.updateOrganizationPlan(
      id,
      data,
      req.user?.id,
    );
  }

  @Patch('organizations/:id/limits')
  async updateOrganizationLimits(
    @Param('id') id: string,
    @Body() data: UpdateOrganizationLimitsDto,
  ) {
    return this.superAdminService.updateOrganizationLimits(id, data);
  }

  @Delete('organizations/:id')
  async deleteOrganization(@Param('id') id: string) {
    return this.superAdminService.deleteOrganization(id);
  }

  @Get('users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
  ) {
    return this.superAdminService.getUsers(Number(page), Number(limit), search);
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() data: any) {
    return this.superAdminService.updateUser(id, data);
  }

  @Post('transfer-user')
  async transferUser(@Body() data: { userId: string; targetOrgId: string }) {
    return this.superAdminService.transferUserToOrganization(
      data.userId,
      data.targetOrgId,
    );
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.superAdminService.deleteUser(id);
  }

  @Get('bug-reports')
  async getBugReports(
    @Query('status') status?: 'OPEN' | 'FIXED',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.superAdminService.getBugReports(
      status,
      Number(page),
      Number(limit),
    );
  }

  @Patch('bug-reports/:id/fix')
  async markBugReportFixed(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.markBugReportFixed(id, req.user?.id);
  }

  @Delete('bug-reports/:id')
  async deleteBugReport(@Param('id') id: string) {
    return this.superAdminService.deleteBugReport(id);
  }
}
