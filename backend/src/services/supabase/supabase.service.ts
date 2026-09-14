import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PostgrestResponse,
  PostgrestSingleResponse,
} from '@supabase/postgrest-js';
import { PrismaService } from '../prisma/prisma.service';
import { Database } from './database.types';
import { LocalSupabaseClient } from './local-supabase-client';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  public readonly client: SupabaseClient<Database>;

  constructor(private readonly prismaService: PrismaService) {
    const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
    const supabaseServiceRoleKey = String(
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    ).trim();

    // Local development without a Supabase REST server: run the same SQL
    // functions and table writes straight against Postgres. Never in prod.
    const localDirect =
      String(process.env.SUPABASE_LOCAL_DIRECT || '').toLowerCase() === 'true';
    if (localDirect && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        'SUPABASE_LOCAL_DIRECT=true: Supabase RPC and table calls run directly on the local Postgres database.',
      );
      this.client = new LocalSupabaseClient(
        prismaService,
      ) as unknown as SupabaseClient<Database>;
      return;
    }
    if (localDirect) {
      this.logger.error(
        'SUPABASE_LOCAL_DIRECT is ignored in production; using the Supabase REST API.',
      );
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Supabase client is initialized with placeholder values.',
      );
    }

    this.client = createClient<Database>(
      supabaseUrl || 'http://localhost:54321',
      supabaseServiceRoleKey || 'missing-service-role-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      const query = this.client
        .from('Organization')
        .select('id', { head: true, count: 'exact' })
        .limit(1);

      const timeout = new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), 3000);
      });

      const result = await Promise.race([query, timeout]);
      if (result === 'timeout') {
        this.logger.warn('Supabase connectivity check timed out.');
        return;
      }

      this.logger.log('Supabase client initialized.');
    } catch (error: any) {
      this.logger.warn(
        `Supabase connectivity check skipped: ${error?.message || 'unknown error'}`,
      );
    }
  }

  get legacyPrisma(): PrismaService {
    return this.prismaService;
  }

  unwrap<T>(response: PostgrestSingleResponse<T> | PostgrestResponse<T>): T {
    if ((response as any)?.error) {
      throw new Error(
        (response as any).error.message || 'Supabase query failed',
      );
    }
    return (response as any).data as T;
  }
}
