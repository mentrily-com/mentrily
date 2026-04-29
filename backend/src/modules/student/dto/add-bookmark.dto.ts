import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AddBookmarkDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  moduleTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  courseTitle?: string;
}
