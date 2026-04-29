import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnterExamDto {
  @IsString()
  @MaxLength(200)
  deviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tabId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
