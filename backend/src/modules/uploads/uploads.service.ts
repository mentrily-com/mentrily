import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { StorageService } from '../../services/storage/storage.service';
import { QuotaService } from '../billing/quota.service';
import { PrismaService } from '../../services/prisma/prisma.service';
import { UPLOAD_KINDS, UploadKind } from './upload-kinds';

@Injectable()
export class UploadsService {
  constructor(
    private readonly storageService: StorageService,
    private readonly quotaService: QuotaService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertAllowed(user: any, kind: UploadKind): Promise<void> {
    const config = UPLOAD_KINDS[kind];

    if (config.allowedRoles && !config.allowedRoles.includes(user?.role)) {
      throw new ForbiddenException(
        'You are not allowed to upload this kind of file',
      );
    }

    // Mirrors OrgStatusGuard: super admins bypass, org-less users pass
    // through (nothing to check), suspended/cancelled orgs are blocked.
    if (
      config.requiresOrgActive &&
      user?.orgId &&
      user.role !== 'SUPER_ADMIN'
    ) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { status: true, name: true },
      });
      if (org && org.status !== 'Active') {
        throw new ForbiddenException(
          `This organization (${org.name}) is currently ${org.status.toLowerCase()}. Please contact support.`,
        );
      }
    }
  }

  async presign(
    user: any,
    body: { kind: UploadKind; filename: string; mimeType: string; sizeBytes: number },
  ) {
    const config = UPLOAD_KINDS[body.kind];
    if (!config) throw new BadRequestException('Unknown upload kind');

    await this.assertAllowed(user, body.kind);

    if (config.allowedMime && !config.allowedMime.includes(body.mimeType)) {
      throw new BadRequestException(
        `File type "${body.mimeType}" is not allowed for this upload`,
      );
    }
    if (body.sizeBytes > config.maxSizeBytes) {
      throw new BadRequestException(
        `File exceeds the ${(config.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB limit`,
      );
    }

    if (config.countsAgainstQuota && user?.orgId) {
      await this.quotaService.checkStorageQuota(
        user.orgId,
        Number((body.sizeBytes / (1024 * 1024)).toFixed(4)),
      );
    }

    const key = this.storageService.buildKey(
      config.folder,
      body.filename,
      user?.orgId,
      user?.id,
    );
    const uploadUrl = await this.storageService.createPresignedPutUrl(
      key,
      body.mimeType,
    );

    return {
      key,
      uploadUrl,
      publicUrl: this.storageService.publicUrl(key),
    };
  }

  async confirm(user: any, body: { kind: UploadKind; key: string }) {
    const config = UPLOAD_KINDS[body.kind];
    if (!config) throw new BadRequestException('Unknown upload kind');

    await this.assertAllowed(user, body.kind);

    if (!body.key.startsWith(`${config.folder}/`)) {
      throw new BadRequestException(
        'Upload key does not match the requested kind',
      );
    }

    // Client-supplied key — verify it was namespaced under the caller's
    // own org/personal namespace before trusting it belongs to them.
    const allowedNamespaces = [
      user?.orgId,
      user?.id ? `user-${user.id}` : null,
    ];
    if (
      !this.storageService.isOwnedByNamespace(
        this.storageService.publicUrl(body.key),
        allowedNamespaces,
      )
    ) {
      throw new ForbiddenException('You do not have access to this upload');
    }

    const head = await this.storageService.headObject(body.key);
    if (!head) {
      throw new BadRequestException(
        'Upload was not found — it may not have completed',
      );
    }
    if (head.contentLength > config.maxSizeBytes) {
      // Client lied about size at presign time — clean up and reject.
      await this.storageService.deleteFile(
        this.storageService.publicUrl(body.key),
      );
      throw new BadRequestException('Uploaded file exceeds the allowed size');
    }

    if (config.countsAgainstQuota && user?.orgId) {
      await this.quotaService.incrementCounter(
        user.orgId,
        'storageUsedMb',
        Number((head.contentLength / (1024 * 1024)).toFixed(4)),
      );
    }

    const publicUrl = this.storageService.publicUrl(body.key);

    if (user?.orgId) {
      await this.prisma.asset.upsert({
        where: { key: body.key },
        update: {},
        create: {
          orgId: user.orgId,
          userId: user.id || null,
          key: body.key,
          url: publicUrl,
          sizeBytes: head.contentLength,
          kind: body.kind,
          mimeType: head.contentType,
        },
      });
    }

    return {
      url: publicUrl,
      name: body.key.split('/').pop(),
      type: head.contentType,
      size: head.contentLength,
    };
  }
}
