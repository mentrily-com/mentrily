import { SetMetadata } from '@nestjs/common';

export const RequireOrgFeature = (feature: string) =>
  SetMetadata('orgFeature', feature);
