import { Module } from '@nestjs/common';
import { ExamService } from './exam.service';
import { ExamController } from './exam.controller';
import { PrismaModule } from '../../services/prisma/prisma.module';
import { TestCodeRotationService } from './test-code-rotation.service';
import { CertificateModule } from '../certificate/certificate.module';
import { NotificationModule } from '../notification/notification.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [PrismaModule, CertificateModule, NotificationModule, OrganizationModule],
  controllers: [ExamController],
  providers: [ExamService, TestCodeRotationService],
  exports: [ExamService],
})
export class ExamModule {}
