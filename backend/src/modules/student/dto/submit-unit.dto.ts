import { Allow, IsIn, IsNumber, IsOptional } from 'class-validator';

export class SubmitUnitDto {
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status: string;

  @Allow()
  content: unknown;

  @IsOptional()
  @IsNumber()
  score?: number;
}
