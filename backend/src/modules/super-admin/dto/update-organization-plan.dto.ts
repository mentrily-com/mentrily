import { IsEnum } from 'class-validator';
import { Plan } from '@prisma/client';

export class UpdateOrganizationPlanDto {
  @IsEnum(Plan)
  plan: Plan;
}
