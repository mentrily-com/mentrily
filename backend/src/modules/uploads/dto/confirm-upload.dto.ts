import { IsIn, IsString, MinLength } from 'class-validator';
import { UPLOAD_KIND_VALUES } from '../upload-kinds';
import type { UploadKind } from '../upload-kinds';

export class ConfirmUploadDto {
  @IsIn(UPLOAD_KIND_VALUES)
  kind: UploadKind;

  @IsString()
  @MinLength(1)
  key: string;
}
