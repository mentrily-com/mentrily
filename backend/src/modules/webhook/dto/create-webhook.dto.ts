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

export class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
