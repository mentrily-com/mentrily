import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendExamInviteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  groupIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customMessage?: string;
}
