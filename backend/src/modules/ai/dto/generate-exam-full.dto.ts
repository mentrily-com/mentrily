import { IsObject, IsOptional, IsString } from 'class-validator';

export class GenerateExamFullDto {
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
