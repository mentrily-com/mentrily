import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CourseService } from './course.service';
import { SupabaseService } from '../../services/supabase/supabase.service';

describe('CourseService - Tenant Isolation', () => {
  let service: CourseService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      course: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      organization: {
        findFirst: jest.fn(),
      },
      unit: {
        findUnique: jest.fn(),
      },
      courseTest: {
        findMany: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue(['0', []]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: mockPrisma,
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CourseService>(CourseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCourse tenant scoping', () => {
    it('scopes course queries with user orgId and allows same-tenant access', async () => {
      const mockCourse = {
        id: 'course-1',
        slug: 'intro-to-cs',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
        tests: [],
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);

      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };
      const result = await service.getCourse('intro-to-cs', user);

      expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: 'intro-to-cs',
            OR: expect.arrayContaining([{ orgId: 'org-alpha' }]),
          }),
        }),
      );
      expect(result.id).toBe('course-1');
    });

    it('rejects access with NotFoundException if course belongs to different org and user not enrolled', async () => {
      const mockCourse = {
        id: 'course-2',
        slug: 'advanced-ai',
        orgId: 'org-beta',
        creatorId: 'teacher-2',
        tests: [],
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);
      mockPrisma.course.count.mockResolvedValue(0); // Not enrolled

      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(service.getCourse('advanced-ai', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects cross-tenant access even if caller is creator when acting in another org', async () => {
      const mockCourse = {
        id: 'course-3',
        slug: 'creator-course',
        orgId: 'org-beta',
        creatorId: 'teacher-1',
        tests: [],
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);
      mockPrisma.course.count.mockResolvedValue(0);

      // Caller created course under org-beta, but active session is org-alpha
      const user = { id: 'teacher-1', role: 'TEACHER', orgId: 'org-alpha' };

      await expect(service.getCourse('creator-course', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects course access when user is not provided and course is org-owned', async () => {
      const mockCourse = {
        id: 'course-1',
        slug: 'intro-to-cs',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
        tests: [],
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);
      mockPrisma.course.count.mockResolvedValue(0);

      await expect(service.getCourse('intro-to-cs', null)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows SUPER_ADMIN to access courses across tenants', async () => {
      const mockCourse = {
        id: 'course-1',
        slug: 'intro-to-cs',
        orgId: 'org-alpha',
        creatorId: 'teacher-1',
        tests: [],
      };
      mockPrisma.course.findFirst.mockResolvedValue(mockCourse);

      const superAdmin = { id: 'admin-super', role: 'SUPER_ADMIN' };
      const result = await service.getCourse('intro-to-cs', superAdmin);
      expect(result.id).toBe('course-1');
    });
  });

  describe('getUnit tenant scoping', () => {
    it('rejects cross-tenant unit access with NotFoundException', async () => {
      const mockUnit = {
        id: 'unit-1',
        title: 'Binary Search',
        module: {
          course: {
            id: 'course-beta',
            orgId: 'org-beta',
            creatorId: 'teacher-2',
          },
        },
      };
      mockPrisma.unit.findUnique.mockResolvedValue(mockUnit);
      mockPrisma.course.count.mockResolvedValue(0);

      const user = { id: 'user-alpha', role: 'STUDENT', orgId: 'org-alpha' };

      await expect(service.getUnit('unit-1', user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPublicCourse tenant scoping', () => {
    it('scopes public course lookup to resolved organization id', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue({
        id: 'org-alpha-id',
        name: 'Alpha Org',
        logo: null,
        plan: 'pro',
      });
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        title: 'Alpha Course',
        slug: 'alpha-course',
        shortDescription: 'Desc',
        longDescription: 'Long',
        thumbnail: null,
        modules: [],
      });

      const result = await service.getPublicCourse('alpha-org', 'alpha-course');

      expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-alpha-id',
            slug: 'alpha-course',
            isVisible: true,
          }),
        }),
      );
      expect(result.course.id).toBe('course-1');
    });
  });
});
