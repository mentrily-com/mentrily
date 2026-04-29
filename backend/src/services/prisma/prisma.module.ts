import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Make it global so we don't need to import it everywhere (optional but handy)
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
