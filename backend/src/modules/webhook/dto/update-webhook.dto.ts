import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';
import { WEBHOOK_EVENTS } from '../webhook.constants';

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
