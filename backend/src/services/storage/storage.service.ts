import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { QuotaService } from '../../modules/billing/quota.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private cdnUrl: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private configService: ConfigService,
    private quotaService: QuotaService,
    private prisma: PrismaService,
  ) {
    const region = this.configService.get<string>('S3_REGION') || 'ap-south-1';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY') || '';
    const secretAccessKey =
      this.configService.get<string>('S3_SECRET_KEY') || '';
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME') || '';
    // Public read path is the CloudFront distribution in front of the
    // (otherwise fully private) bucket — never the bucket's own S3 endpoint.
    this.cdnUrl = this.configService.get<string>('S3_CDN_URL') || '';

    if (!accessKeyId || !secretAccessKey || !this.bucketName || !this.cdnUrl) {
      this.logger.warn(
        'Storage (AWS S3) configuration is missing. File uploads will fail.',
      );
    }

    this.s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /**
   * Namespace an object key by org (or, for org-less personal accounts, by
   * owner) so ownership can be verified at delete/confirm time without a DB
   * lookup.
   */
  buildKey(
    folder: string,
    filename: string,
    orgId?: string,
    ownerId?: string,
  ): string {
    const fileExtension = filename.split('.').pop();
    const namespace = orgId || (ownerId ? `user-${ownerId}` : null);
    return namespace
      ? `${folder}/${namespace}/${randomUUID()}.${fileExtension}`
      : `${folder}/${randomUUID()}.${fileExtension}`;
  }

  publicUrl(key: string): string {
    return `${this.cdnUrl}/${key}`;
  }

  /**
   * Create a short-lived presigned PUT URL so the browser can upload an
   * object directly to S3 — file bytes never transit this backend.
   */
  async createPresignedPutUrl(
    key: string,
    mimetype: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimetype,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Look up the size (and existence) of an object — used to confirm a
   * direct browser upload actually completed before trusting its URL.
   */
  async headObject(
    key: string,
  ): Promise<{ contentLength: number; contentType?: string } | null> {
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return {
        contentLength:
          typeof head.ContentLength === 'number' ? head.ContentLength : 0,
        contentType: head.ContentType,
      };
    } catch {
      return null;
    }
  }

  /**
   * Upload a file directly from the backend (server-generated files only —
   * certificate PDFs, sharp-processed signature images). Everything else
   * uploads directly to S3 via a presigned URL (see UploadsService).
   * @returns Public (CDN) URL of the uploaded file
   */
  async uploadFile(
    fileData: any,
    filename: string,
    mimetype: string,
    folder: string = 'uploads',
    contentLength?: number,
    orgId?: string,
    ownerId?: string,
  ): Promise<string> {
    if (!fileData) {
      throw new Error('File data is required');
    }

    const key = this.buildKey(folder, filename, orgId, ownerId);
    const uploadSizeMb = contentLength
      ? Number((contentLength / (1024 * 1024)).toFixed(4))
      : 0;

    if (orgId && uploadSizeMb > 0) {
      await this.quotaService.checkStorageQuota(orgId, uploadSizeMb);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileData,
      ContentType: mimetype,
      ContentLength: contentLength,
    });

    try {
      this.logger.log(
        `Uploading file ${filename} to S3: ${this.bucketName}/${key}`,
      );
      await this.s3Client.send(command);
      this.logger.log(`File uploaded successfully: ${key}`);

      if (orgId && uploadSizeMb > 0) {
        await this.quotaService.incrementCounter(
          orgId,
          'storageUsedMb',
          uploadSizeMb,
        );
      }

      return this.publicUrl(key);
    } catch (error) {
      this.logger.error(
        `Failed to upload file ${filename}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a file from S3 by its public (CDN) URL.
   * Non-throwing: logs errors but doesn't break the caller.
   */
  async deleteFile(
    fileUrl: string,
    orgId?: string,
    contentLength?: number,
  ): Promise<void> {
    if (!fileUrl) return;

    try {
      const key = this.extractKeyFromUrl(fileUrl);

      if (!key) {
        this.logger.warn(`Could not extract S3 key from URL: ${fileUrl}`);
        return;
      }

      let effectiveContentLength = contentLength;
      if (orgId && (!effectiveContentLength || effectiveContentLength <= 0)) {
        const head = await this.headObject(key);
        if (head) effectiveContentLength = head.contentLength;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      this.logger.log(`Deleting file from S3: ${this.bucketName}/${key}`);
      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);

      const deletionSizeMb = effectiveContentLength
        ? Number((effectiveContentLength / (1024 * 1024)).toFixed(4))
        : 0;
      if (orgId && deletionSizeMb > 0) {
        await this.quotaService.decrementCounter(
          orgId,
          'storageUsedMb',
          deletionSizeMb,
        );
      }

      try {
        await this.prisma.asset.deleteMany({
          where: { key: key },
        });
      } catch (assetError) {
        this.logger.error(
          `Failed to delete asset record: ${assetError.message}`,
          assetError.stack,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      // Non-throwing: don't block the caller if cleanup fails
    }
  }

  /**
   * Verifies a file URL was uploaded under one of the caller's own
   * namespaces (their orgId, or `user-${userId}` for org-less personal
   * uploads) before an endpoint that accepts a CLIENT-SUPPLIED url is
   * allowed to delete it. Legacy keys uploaded before namespacing existed
   * (flat `folder/uuid.ext` shape) have no verifiable owner and are
   * rejected by default — pass `allowUnnamespacedLegacy: true` only for
   * callers where the URL is independently known to be server-derived
   * (already-authorized), never for a raw client-supplied URL.
   */
  isOwnedByNamespace(
    fileUrl: string,
    allowedNamespaces: (string | undefined | null)[],
    options?: { allowUnnamespacedLegacy?: boolean },
  ): boolean {
    const key = this.extractKeyFromUrl(fileUrl);
    if (!key) return false;

    const parts = key.split('/');
    // folder/namespace/filename = 3 segments; legacy folder/filename = 2.
    if (parts.length < 3) {
      return Boolean(options?.allowUnnamespacedLegacy);
    }

    const namespace = parts[1];
    const allowed = new Set(
      allowedNamespaces.filter((value): value is string => Boolean(value)),
    );
    return allowed.has(namespace);
  }

  /**
   * Extract the object key from a public CDN URL.
   * Supports:
   *  - https://<cloudfront-domain>/<key>
   *  - Legacy DigitalOcean Spaces / Supabase URLs (graceful fallback for
   *    any URLs stored in the DB from a previous storage provider)
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      if (this.cdnUrl && url.startsWith(this.cdnUrl)) {
        return urlObj.pathname.replace(/^\//, '');
      }

      // Legacy DigitalOcean Spaces: <bucket>.<region>.digitaloceanspaces.com/<key>
      if (urlObj.hostname.includes('digitaloceanspaces.com')) {
        return urlObj.pathname.replace(/^\//, '');
      }

      // Legacy Supabase fallback: /storage/v1/object/public/<bucket>/<key>
      const supabaseMatch = url.match(
        /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/,
      );
      if (supabaseMatch) return supabaseMatch[1];

      // Generic fallback: whole pathname is the key (CDN has no bucket
      // segment in the URL, unlike the legacy providers above).
      const pathname = urlObj.pathname.replace(/^\//, '');
      return pathname || null;
    } catch {
      return null;
    }
  }
}
