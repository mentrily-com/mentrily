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
  // `require_tld` stays on and the scheme is pinned to http(s): a bare
  // hostname or a non-http scheme is only ever useful for reaching something
  // on the internal network. Dispatch is filtered at connect time too (see
  // common/safe-http.ts) — this just rejects the endpoint at creation, where
  // the operator gets a clear error instead of silent delivery failures.
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: true,
  })
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
