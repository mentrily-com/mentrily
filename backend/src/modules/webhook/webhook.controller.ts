import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrgStatusGuard } from '../auth/guards/org-status.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import { RequirePlan } from '../auth/plan.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@Controller('admin/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard, OrgStatusGuard, PlanGuard)
@Roles('ADMIN')
@RequirePlan('apiAccess')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async create(@User() user: any, @Body() data: CreateWebhookDto) {
    return this.webhookService.create(user, data);
  }

  @Get()
  async list(@User() user: any) {
    return this.webhookService.list(user);
  }

  @Patch(':id')
  async update(
    @User() user: any,
    @Param('id') id: string,
    @Body() data: UpdateWebhookDto,
  ) {
    return this.webhookService.update(user, id, data);
  }

  @Delete(':id')
  async remove(@User() user: any, @Param('id') id: string) {
    return this.webhookService.remove(user, id);
  }
}
