import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PLAN_FEATURE_KEY = 'requiredPlanFeature';

export const RequirePlan = (feature: string) =>
  SetMetadata(REQUIRED_PLAN_FEATURE_KEY, feature);
