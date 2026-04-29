import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { StorageService } from '../../services/storage/storage.service';
import axios from 'axios';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
} from './dto/create-template.dto';
import { DEFAULT_APP_URL } from '../../config/app-brand';

const PDFDocument = require('pdfkit');

type CertificateType = 'course' | 'exam';

@Injectable()
export class CertificateService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  private requireOrgId(orgId?: string | null): string {
    const normalized = String(orgId || '').trim();
    if (!normalized) {
      throw new BadRequestException('Organization context is required');
    }
    return normalized;
  }

  private getAppBaseUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      DEFAULT_APP_URL
    ).replace(/\/$/, '');
  }

  private defaultTemplateLayout() {
    return {
      title: {
        x: 0,
        y: 145,
        width: 595,
        align: 'center',
        fontSize: 28,
        color: '#0F172A',
        text: 'Certificate of Achievement',
      },
      subtitle: {
        x: 0,
        y: 210,
        width: 595,
        align: 'center',
        fontSize: 14,
        color: '#475569',
        text: 'This certifies that',
      },
      studentName: {
        x: 0,
        y: 238,
        width: 595,
        align: 'center',
        fontSize: 24,
        color: '#0F172A',
      },
      descriptor: {
        x: 0,
        y: 284,
        width: 595,
        align: 'center',
        fontSize: 14,
        color: '#475569',
      },
      resourceTitle: {
        x: 0,
        y: 312,
        width: 595,
        align: 'center',
        fontSize: 20,
        color: '#1E293B',
      },
      scoreLine: {
        x: 0,
        y: 352,
        width: 595,
        align: 'center',
        fontSize: 13,
        color: '#475569',
      },
      issuedLine: {
        x: 0,
        y: 388,
        width: 595,
        align: 'center',
        fontSize: 12,
        color: '#64748B',
      },
      logo: { x: 52, y: 42, width: 72, height: 72 },
      signature: { x: 438, y: 468, width: 120, height: 60 },
      qrCode: { x: 54, y: 455, width: 90, height: 90 },
      verificationText: {
        x: 150,
        y: 535,
        width: 390,
        align: 'left',
        fontSize: 9,
        color: '#64748B',
      },
    };
  }

  private normalizeLayout(layout: any): any {
    const fallback = this.defaultTemplateLayout();
    if (!layout || typeof layout !== 'object') return fallback;
    return { ...fallback, ...layout };
  }

  private drawText(
    doc: any,
    content: string,
    block: any,
    fallback: { x: number; y: number; width?: number; align?: string },
  ) {
    const x = Number.isFinite(Number(block?.x)) ? Number(block.x) : fallback.x;
    const y = Number.isFinite(Number(block?.y)) ? Number(block.y) : fallback.y;
    const width = Number.isFinite(Number(block?.width))
      ? Number(block.width)
      : fallback.width;
    const align =
      typeof block?.align === 'string' ? block.align : (fallback.align ?? 'left');
    const fontSize = Number.isFinite(Number(block?.fontSize))
      ? Number(block.fontSize)
      : 14;
    const color =
      typeof block?.color === 'string' && block.color
        ? block.color
        : '#0F172A';

    doc.fontSize(fontSize).fillColor(color);
    if (width) {
      doc.text(content, x, y, { width, align });
      return;
    }
    doc.text(content, x, y);
  }

  private async renderCertificatePdf(params: {
    studentName: string;
    orgName: string;
    orgLogo?: string | null;
    title: string;
    type: CertificateType;
    score?: number | null;
    completionPercent?: number | null;
    issuedAt: Date;
    template?: any;
    qrCodeBuffer?: Buffer;
    verificationUrl: string;
  }): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      const layout = this.normalizeLayout(params.template?.layout);

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (params.template?.backgroundUrl) {
        try {
          const backgroundResp = await axios.get(params.template.backgroundUrl, {
            responseType: 'arraybuffer',
            timeout: 8000,
          });
          const background = Buffer.from(backgroundResp.data);
          doc.image(background, 0, 0, {
            fit: [doc.page.width, doc.page.height],
          });
        } catch {
          doc
            .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
            .lineWidth(2)
            .stroke('#D97706');
        }
      } else {
        doc
          .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
          .lineWidth(2)
          .stroke('#D97706');
      }

      if (params.orgLogo) {
        try {
          const response = await axios.get(params.orgLogo, {
            responseType: 'arraybuffer',
            timeout: 6000,
          });
          const imageBuffer = Buffer.from(response.data);
          const logoBlock = {
            ...layout.logo,
            ...(params.template?.logoPosition || {}),
          };
          const logoX = Number.isFinite(Number(logoBlock?.x))
            ? Number(logoBlock.x)
            : 52;
          const logoY = Number.isFinite(Number(logoBlock?.y))
            ? Number(logoBlock.y)
            : 42;
          const logoW = Number.isFinite(Number(logoBlock?.width))
            ? Number(logoBlock.width)
            : 72;
          const logoH = Number.isFinite(Number(logoBlock?.height))
            ? Number(logoBlock.height)
            : 72;
          doc.image(imageBuffer, logoX, logoY, { fit: [logoW, logoH] });
        } catch {}
      }

      this.drawText(doc, params.orgName, layout.orgName, {
        x: 52,
        y: 126,
        width: 260,
        align: 'left',
      });

      this.drawText(
        doc,
        String(layout.title?.text || 'Certificate of Achievement'),
        layout.title,
        {
          x: 0,
          y: 145,
          width: 595,
          align: 'center',
        },
      );

      this.drawText(
        doc,
        String(layout.subtitle?.text || 'This certifies that'),
        layout.subtitle,
        {
          x: 0,
          y: 210,
          width: 595,
          align: 'center',
        },
      );

      this.drawText(
        doc,
        params.studentName || 'Student',
        layout.studentName,
        {
          x: 0,
          y: 238,
          width: 595,
          align: 'center',
        },
      );

      const descriptor =
        params.type === 'course'
          ? 'has successfully completed the course'
          : 'has successfully passed the exam';

      this.drawText(doc, descriptor, layout.descriptor, {
        x: 0,
        y: 284,
        width: 595,
        align: 'center',
      });

      this.drawText(doc, params.title, layout.resourceTitle, {
        x: 0,
        y: 312,
        width: 595,
        align: 'center',
      });

      const scoreText =
        params.type === 'course'
          ? `Completion: ${params.completionPercent ?? 100}%`
          : `Score: ${params.score ?? 0}`;
      this.drawText(doc, scoreText, layout.scoreLine, {
        x: 0,
        y: 352,
        width: 595,
        align: 'center',
      });

      this.drawText(
        doc,
        `Issued on ${params.issuedAt.toLocaleDateString()}`,
        layout.issuedLine,
        {
          x: 0,
          y: 388,
          width: 595,
          align: 'center',
        },
      );

      if (params.template?.signatureUrl && layout.signature) {
        try {
          const signatureResp = await axios.get(params.template.signatureUrl, {
            responseType: 'arraybuffer',
            timeout: 6000,
          });
          const signatureBuffer = Buffer.from(signatureResp.data);
          const sigX = Number.isFinite(Number(layout.signature?.x))
            ? Number(layout.signature.x)
            : 438;
          const sigY = Number.isFinite(Number(layout.signature?.y))
            ? Number(layout.signature.y)
            : 468;
          const sigW = Number.isFinite(Number(layout.signature?.width))
            ? Number(layout.signature.width)
            : 120;
          const sigH = Number.isFinite(Number(layout.signature?.height))
            ? Number(layout.signature.height)
            : 60;
          doc.image(signatureBuffer, sigX, sigY, { fit: [sigW, sigH] });
        } catch {}
      }

      if (params.qrCodeBuffer && layout.qrCode) {
        const qrX = Number.isFinite(Number(layout.qrCode?.x))
          ? Number(layout.qrCode.x)
          : 54;
        const qrY = Number.isFinite(Number(layout.qrCode?.y))
          ? Number(layout.qrCode.y)
          : 455;
        const qrW = Number.isFinite(Number(layout.qrCode?.width))
          ? Number(layout.qrCode.width)
          : 90;
        const qrH = Number.isFinite(Number(layout.qrCode?.height))
          ? Number(layout.qrCode.height)
          : 90;
        doc.image(params.qrCodeBuffer, qrX, qrY, { fit: [qrW, qrH] });
      }

      this.drawText(
        doc,
        `Verification URL: ${params.verificationUrl}`,
        layout.verificationText,
        {
          x: 150,
          y: 535,
          width: 390,
          align: 'left',
        },
      );

      doc.end();
    });
  }

  async listTemplates(orgId: string) {
    const resolvedOrgId = String(orgId || '').trim();
    if (!resolvedOrgId) {
      return [];
    }

    return (this.prisma as any).certificateTemplate.findMany({
      where: { orgId: resolvedOrgId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getTemplate(orgId: string, id: string) {
    const resolvedOrgId = this.requireOrgId(orgId);
    const template = await (this.prisma as any).certificateTemplate.findFirst({
      where: { id, orgId: resolvedOrgId },
    });

    if (!template) {
      throw new NotFoundException('Certificate template not found');
    }

    return template;
  }

  async createTemplate(orgId: string, creatorId: string, dto: CreateTemplateDto) {
    const resolvedOrgId = this.requireOrgId(orgId);

    if (!dto?.name?.trim()) {
      throw new BadRequestException('Template name is required');
    }

    if (dto.isDefault) {
      await (this.prisma as any).certificateTemplate.updateMany({
        where: { orgId: resolvedOrgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return (this.prisma as any).certificateTemplate.create({
      data: {
        orgId: resolvedOrgId,
        creatorId,
        name: dto.name.trim(),
        layout: dto.layout || this.defaultTemplateLayout(),
        backgroundUrl: dto.backgroundUrl,
        isDefault: !!dto.isDefault,
      },
    });
  }

  async updateTemplate(orgId: string, id: string, dto: UpdateTemplateDto) {
    const resolvedOrgId = this.requireOrgId(orgId);
    await this.getTemplate(resolvedOrgId, id);

    if (dto.isDefault) {
      await (this.prisma as any).certificateTemplate.updateMany({
        where: { orgId: resolvedOrgId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return (this.prisma as any).certificateTemplate.update({
      where: { id },
      data: {
        name: typeof dto.name === 'string' ? dto.name.trim() : undefined,
        layout: dto.layout,
        backgroundUrl: dto.backgroundUrl,
        isDefault:
          typeof dto.isDefault === 'boolean' ? dto.isDefault : undefined,
      },
    });
  }

  async deleteTemplate(orgId: string, id: string) {
    const resolvedOrgId = this.requireOrgId(orgId);
    await this.getTemplate(resolvedOrgId, id);
    await (this.prisma as any).certificateTemplate.delete({ where: { id } });
    return { success: true };
  }

  async uploadSignature(params: {
    orgId: string;
    templateId: string;
    fileBuffer: Buffer;
    filename: string;
    mimeType: string;
    contentLength?: number;
  }) {
    const resolvedOrgId = this.requireOrgId(params.orgId);

    if (!params.fileBuffer?.length) {
      throw new BadRequestException('Signature file is required');
    }

    const template = await this.getTemplate(resolvedOrgId, params.templateId);

    const optimized = await sharp(params.fileBuffer)
      .resize({ width: 480, withoutEnlargement: true })
      .png({ quality: 90 })
      .toBuffer();

    const signatureUrl = await this.storageService.uploadFile(
      optimized,
      `${template.id}-signature.png`,
      'image/png',
      'certificate-signatures',
      optimized.length,
      resolvedOrgId,
    );

    const updated = await (this.prisma as any).certificateTemplate.update({
      where: { id: template.id },
      data: { signatureUrl },
    });

    return {
      id: updated.id,
      signatureUrl: updated.signatureUrl,
    };
  }

  async generateCertificate(
    studentId: string,
    type: CertificateType,
    resourceId: string,
    templateId?: string,
  ) {
    const existing = await (this.prisma as any).certificate.findFirst({
      where: { userId: studentId, type, resourceId },
    });

    if (existing) {
      return existing;
    }

    const student: any = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        email: true,
        orgId: true,
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
            status: true,
          },
        },
      },
    });

    if (!student?.id || !student?.orgId || !student?.organization) {
      throw new NotFoundException('Student or organization not found');
    }

    const orgStatus = String(student.organization.status || '').toLowerCase();
    if (orgStatus !== 'active') {
      throw new NotFoundException('Organization is not active');
    }

    let title = '';
    let score: number | null = null;
    let completionPercent: number | null = null;
    let resolvedTemplateId = templateId;
    let requiredExamScore = 80;

    if (type === 'course') {
      const course: any = await this.prisma.course.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          title: true,
          orgId: true,
          completionThreshold: true,
          certificateTemplateId: true,
        },
      });

      if (!course || course.orgId !== student.orgId) {
        throw new NotFoundException('Course not found');
      }

      const progress = await this.prisma.courseProgress.findFirst({
        where: { userId: studentId, courseId: course.id },
        select: { percent: true },
      });

      const percent = Number(progress?.percent || 0);
      const requiredCompletion = Number(course.completionThreshold ?? 100);
      if (percent < requiredCompletion) {
        throw new NotFoundException('Course completion threshold not met');
      }

      title = course.title;
      completionPercent = percent;
      if (!resolvedTemplateId && course.certificateTemplateId) {
        resolvedTemplateId = course.certificateTemplateId;
      }
    } else {
      const session: any = await this.prisma.examSession.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          userId: true,
          examId: true,
          score: true,
          exam: {
            select: {
              id: true,
              title: true,
              orgId: true,
              linkedCourseId: true,
            },
          },
        },
      });

      if (
        !session ||
        session.userId !== studentId ||
        session.exam?.orgId !== student.orgId
      ) {
        throw new NotFoundException('Exam session not found');
      }

      if (session.exam?.linkedCourseId) {
        const linkedCourse: any = await this.prisma.course.findUnique({
          where: { id: session.exam.linkedCourseId },
          select: {
            examPassThreshold: true,
            certificateTemplateId: true,
          },
        });
        if (Number.isFinite(Number(linkedCourse?.examPassThreshold))) {
          requiredExamScore = Number(linkedCourse.examPassThreshold);
        }
        if (!resolvedTemplateId && linkedCourse?.certificateTemplateId) {
          resolvedTemplateId = linkedCourse.certificateTemplateId;
        }
      }

      const numericScore = Number(session.score || 0);
      if (numericScore < requiredExamScore) {
        throw new NotFoundException('Exam score threshold not met');
      }

      title = session.exam.title;
      score = numericScore;
    }

    let template: any = null;
    if (resolvedTemplateId) {
      template = await (this.prisma as any).certificateTemplate.findFirst({
        where: { id: resolvedTemplateId, orgId: student.orgId },
      });
    }
    if (!template) {
      template = await (this.prisma as any).certificateTemplate.findFirst({
        where: { orgId: student.orgId, isDefault: true },
      });
      resolvedTemplateId = template?.id;
    }

    const issuedAt = new Date();
    const qrCode = nanoid(12);
    const verificationUrl = `${this.getAppBaseUrl()}/certificate/verify/${qrCode}`;
    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const pdfBuffer = await this.renderCertificatePdf({
      studentName: String(student.name || student.email || 'Student'),
      orgName: String(student.organization.name || 'Organization'),
      orgLogo: student.organization.logo,
      title,
      type,
      score,
      completionPercent,
      issuedAt,
      template,
      qrCodeBuffer,
      verificationUrl,
    });

    const filename = `${type}-certificate-${resourceId}-${qrCode}.pdf`;
    const fileUrl = await this.storageService.uploadFile(
      pdfBuffer,
      filename,
      'application/pdf',
      'certificates',
      pdfBuffer.length,
      student.orgId,
    );

    const certificateId = randomUUID();

    try {
      const created = await (this.prisma as any).certificate.create({
        data: {
          id: certificateId,
          userId: studentId,
          orgId: student.orgId,
          type,
          resourceId,
          title,
          score,
          completionPercent,
          fileUrl,
          templateId: resolvedTemplateId || null,
          qrCode,
          verificationUrl,
          metadata: {
            requiredExamScore,
            issuedFromTemplate: resolvedTemplateId || null,
          },
          issuedAt,
        },
      });

      return created;
    } catch {
      const raceSafe = await (this.prisma as any).certificate.findFirst({
        where: { userId: studentId, type, resourceId },
      });
      if (raceSafe) return raceSafe;
      throw new NotFoundException('Failed to save certificate');
    }
  }

  async verifyCertificate(code: string) {
    const certificate = await (this.prisma as any).certificate.findUnique({
      where: { qrCode: code },
      select: {
        id: true,
        type: true,
        title: true,
        score: true,
        completionPercent: true,
        fileUrl: true,
        issuedAt: true,
        verificationUrl: true,
        metadata: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
            slug: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return {
      valid: true,
      certificate,
    };
  }

  async listCertificates(studentId: string) {
    const { data, error } = await (this.supabase.client as any).rpc(
      'list_certificates',
      {
        p_user_id: studentId,
      },
    );

    if (error) {
      throw new NotFoundException(
        error.message || 'Failed to list certificates',
      );
    }

    return data || [];
  }

  async getCertificateForUser(studentId: string, certificateId: string) {
    const certificate = await (this.prisma as any).certificate.findFirst({
      where: {
        id: certificateId,
        userId: studentId,
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }
}
