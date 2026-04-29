import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { StudentService } from './student.service';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ExamService } from '../exam/exam.service';
import { CertificateService } from '../certificate/certificate.service';

describe('StudentService', () => {
  let service: StudentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        {
          provide: SupabaseService,
          useValue: {
            client: { rpc: jest.fn(), from: jest.fn() },
            legacyPrisma: {},
          },
        },
        { provide: ExamService, useValue: { transformExam: jest.fn() } },
        {
          provide: CertificateService,
          useValue: {
            listCertificates: jest.fn(),
            getCertificateForUser: jest.fn(),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
          },
        },
        {
          provide: getQueueToken('student-analytics'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
