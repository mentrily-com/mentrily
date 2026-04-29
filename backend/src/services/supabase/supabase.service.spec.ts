import { SupabaseService } from './supabase.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SupabaseService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should be defined and expose legacy prisma', () => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

    const prisma = {} as PrismaService;
    const service = new SupabaseService(prisma);

    expect(service).toBeDefined();
    expect(service.legacyPrisma).toBe(prisma);
  });

  it('unwrap should return data when response is successful', () => {
    const service = new SupabaseService({} as PrismaService);
    const response = { data: { ok: true }, error: null } as any;

    expect(service.unwrap(response)).toEqual({ ok: true });
  });

  it('unwrap should throw when response has error', () => {
    const service = new SupabaseService({} as PrismaService);
    const response = { data: null, error: { message: 'boom' } } as any;

    expect(() => service.unwrap(response)).toThrow('boom');
  });
});
