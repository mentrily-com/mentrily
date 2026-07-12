import { IsIn, IsInt, IsString, Min, MinLength } from 'class-validator';
import { UPLOAD_KIND_VALUES } from '../upload-kinds';
import type { UploadKind } from '../upload-kinds';

export class PresignUploadDto {
  @IsIn(UPLOAD_KIND_VALUES)
  kind: UploadKind;

  @IsString()
  @MinLength(1)
  filename: string;

  @IsString()
  @MinLength(1)
  mimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;
}
