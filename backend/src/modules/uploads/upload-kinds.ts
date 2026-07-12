export type UploadKind =
  | 'course-video'
  | 'bug-report'
  | 'announcement'
  | 'org-logo';

export interface UploadKindConfig {
  folder: string;
  maxSizeBytes: number;
  allowedMime: string[] | null;
  allowedRoles?: string[];
  requiresOrgActive?: boolean;
  countsAgainstQuota: boolean;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ANNOUNCEMENT_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
];

export const UPLOAD_KINDS: Record<UploadKind, UploadKindConfig> = {
  'course-video': {
    folder: 'courseVideos',
    maxSizeBytes: 500 * 1024 * 1024,
    allowedMime: VIDEO_TYPES,
    countsAgainstQuota: true,
  },
  'bug-report': {
    folder: 'reported-bugs',
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMime: IMAGE_TYPES,
    allowedRoles: ['STUDENT', 'TEACHER', 'ADMIN'],
    countsAgainstQuota: true,
  },
  announcement: {
    folder: 'announcements',
    maxSizeBytes: 25 * 1024 * 1024,
    allowedMime: ANNOUNCEMENT_TYPES,
    requiresOrgActive: true,
    countsAgainstQuota: true,
  },
  'org-logo': {
    folder: 'organizations',
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMime: IMAGE_TYPES,
    allowedRoles: ['SUPER_ADMIN'],
    countsAgainstQuota: false,
  },
};

export const UPLOAD_KIND_VALUES = Object.keys(UPLOAD_KINDS) as UploadKind[];
