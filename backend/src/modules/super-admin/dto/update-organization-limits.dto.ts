import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

const toNumber = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
};

export class UpdateOrganizationLimitsDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  students?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  courses?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  examsPerMonth?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  storageMb?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  seats?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  adminSeats?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(-1)
  teacherSeats?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedQuestionTypes?: string[];

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  maxAdminSeats?: number;
}
