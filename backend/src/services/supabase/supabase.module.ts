import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SupabaseService],
  exports: [SupabaseService, PrismaModule],
})
export class SupabaseModule {}
