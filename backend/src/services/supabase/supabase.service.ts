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

    const localDirect =
      String(process.env.SUPABASE_LOCAL_DIRECT || '').toLowerCase() === 'true';
    if (localDirect) {
      this.logger.log(
        'SUPABASE_LOCAL_DIRECT=true: Supabase RPC and table calls run directly on Postgres via Prisma.',
      );
      this.client = new LocalSupabaseClient(
        prismaService,
      ) as unknown as SupabaseClient<Database>;
      return;
    }

    const isPlaceholderKey =
      !supabaseServiceRoleKey ||
      supabaseServiceRoleKey === 'missing-service-role-key' ||
      supabaseServiceRoleKey.startsWith('placeholder');

    let isMismatchedKey = false;
    if (supabaseServiceRoleKey && supabaseUrl) {
      try {
        const parts = supabaseServiceRoleKey.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          const tokenRef = payload?.ref;
          const url = new URL(supabaseUrl);
          const hostnameRef = url.hostname.split('.')[0];
          if (tokenRef && hostnameRef && tokenRef !== hostnameRef) {
            isMismatchedKey = true;
          }
        }
      } catch {
        // Ignore parse error
      }
    }

    if (isPlaceholderKey || isMismatchedKey) {
      this.logger.warn(
        isMismatchedKey
          ? 'SUPABASE_SERVICE_ROLE_KEY project ref does not match SUPABASE_URL. Falling back to direct Postgres mode.'
          : 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to direct Postgres mode.',
      );
      this.client = new LocalSupabaseClient(
        prismaService,
      ) as unknown as SupabaseClient<Database>;
      return;
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
    if ((this.client as any) instanceof LocalSupabaseClient) {
      this.logger.log('Direct Postgres mode active for Supabase calls.');
      return;
    }

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
        this.logger.warn(
          'Supabase REST connectivity check timed out. Falling back to direct Postgres mode.',
        );
        (this as any).client = new LocalSupabaseClient(this.prismaService);
        return;
      }

      if ((result as any)?.error) {
        this.logger.warn(
          `Supabase REST connectivity check returned error (${(result as any).error.message}). Falling back to direct Postgres mode.`,
        );
        (this as any).client = new LocalSupabaseClient(this.prismaService);
        return;
      }

      this.logger.log('Supabase client initialized.');
    } catch (error: any) {
      this.logger.warn(
        `Supabase connectivity check failed: ${error?.message || 'unknown error'}. Falling back to direct Postgres mode.`,
      );
      (this as any).client = new LocalSupabaseClient(this.prismaService);
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
