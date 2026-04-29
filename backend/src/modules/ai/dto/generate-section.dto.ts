import { IsObject, IsString } from 'class-validator';

export class GenerateSectionDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsObject()
  section: {
    id: string;
    title: string;
    description?: string;
    questions?: unknown[];
  };
}
