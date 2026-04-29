import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgStatusGuard } from '../auth/guards/org-status.guard';
import { User } from '../auth/user.decorator';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/create-template.dto';

@Controller()
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  private resolveOrgId(user: any): string {
    const existingOrgId = String(user?.orgId || '').trim();
    if (existingOrgId) {
      return existingOrgId;
    }

    throw new BadRequestException(
      'Certificate templates are available only for organization-backed plans.',
    );
  }

  @Get('teacher/certificate-templates')
  @UseGuards(JwtAuthGuard, OrgStatusGuard)
  async listTemplates(@User() user: any) {
    const orgId = this.resolveOrgId(user);
    return this.certificateService.listTemplates(orgId);
  }

  @Post('teacher/certificate-templates')
  @UseGuards(JwtAuthGuard, OrgStatusGuard)
  async createTemplate(
    @User() user: any,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    data: CreateTemplateDto,
  ) {
    const orgId = this.resolveOrgId(user);
    return this.certificateService.createTemplate(orgId, user.id, data);
  }

  @Put('teacher/certificate-templates/:id')
  @UseGuards(JwtAuthGuard, OrgStatusGuard)
  async updateTemplate(
    @Param('id') id: string,
    @User() user: any,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    data: UpdateTemplateDto,
  ) {
    const orgId = this.resolveOrgId(user);
    return this.certificateService.updateTemplate(orgId, id, data);
  }

  @Delete('teacher/certificate-templates/:id')
  @UseGuards(JwtAuthGuard, OrgStatusGuard)
  async deleteTemplate(@Param('id') id: string, @User() user: any) {
    const orgId = this.resolveOrgId(user);
    return this.certificateService.deleteTemplate(orgId, id);
  }

  @Post('teacher/certificate-templates/:id/signature')
  @UseGuards(JwtAuthGuard, OrgStatusGuard)
  async uploadSignature(
    @Param('id') id: string,
    @User() user: any,
    @Req() req: FastifyRequest,
  ) {
    const orgId = this.resolveOrgId(user);
    const multipartReq = req as any;
    if (!multipartReq.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    const parts = multipartReq.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        return this.certificateService.uploadSignature({
          orgId,
          templateId: id,
          fileBuffer: buffer,
          filename: part.filename,
          mimeType: part.mimetype,
          contentLength: buffer.length,
        });
      }
    }

    throw new BadRequestException('No signature file provided');
  }

  @Get('certificate/verify/:code')
  async verifyCertificate(@Param('code') code: string) {
    return this.certificateService.verifyCertificate(code);
  }
}
