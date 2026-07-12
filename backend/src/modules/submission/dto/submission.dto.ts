import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SaveAnswerDto {
  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sectionId?: string;

  @IsObject()
  answer: Record<string, unknown>;
}

export class SubmitSectionDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @MaxLength(200)
  sectionId: string;

  @IsObject()
  answers: Record<string, unknown>;
}

export class SubmitExamDto {
  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}
