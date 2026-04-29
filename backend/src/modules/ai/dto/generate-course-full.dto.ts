import { IsObject, IsOptional, IsString } from 'class-validator';

export class GenerateCourseFullDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsObject()
  outline: Record<string, unknown>;

  @IsOptional()
  @IsString()
  courseSummary?: string;
}
