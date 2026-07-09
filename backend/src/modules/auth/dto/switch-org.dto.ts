import { IsString, MinLength } from 'class-validator';

export class SwitchOrgDto {
  @IsString()
  @MinLength(1)
  orgId: string;
}
