import { SetMetadata } from '@nestjs/common';

export const ORG_REQUIRED_KEY = 'orgRequired';

export const RequireOrg = () => SetMetadata(ORG_REQUIRED_KEY, true);
