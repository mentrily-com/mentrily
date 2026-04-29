const UNLIMITED = -1;

export const PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const;
export type PlanKey = (typeof PLANS)[number];

type PlanLimitConfig = {
  students: number;
  courses: number;
  examsPerMonth: number;
  storageMb: number;
  adminSeats: number;
  teacherSeats: number;
  seats: number;
  modulesPerCourse: number;
  examsPerCourse: number;
  codeExecs: number;
  allowedQuestionTypes: string[];
};

type PlanFeatureConfig = {
  coding: boolean;
  webEditor: boolean;
  pythonNotebook: boolean;
  proctoring: boolean;
  aiExams: boolean;
  bulkImport: boolean;
  whiteLabel: boolean;
  customDomain: boolean;
  impersonation: boolean;
  advancedAnalytics: boolean;
  tabSwitch: boolean;
  ipTracking: boolean;
  apiAccess: boolean;
  certificates: boolean;
  subdomain: boolean;
  customSlug: boolean;
};

type PlanLimitOverrideKey = keyof PlanLimitConfig;

const LIMIT_OVERRIDE_KEYS: PlanLimitOverrideKey[] = [
  'students',
  'courses',
  'examsPerMonth',
  'storageMb',
  'adminSeats',
  'teacherSeats',
  'seats',
  'modulesPerCourse',
  'examsPerCourse',
  'codeExecs',
];

const ORG_ONLY_PLAN_FEATURES = new Set<keyof PlanFeatureConfig>([
  'whiteLabel',
  'customDomain',
  'subdomain',
]);

const FEATURE_REQUIRED_PLAN: Record<string, PlanKey> = {
  coding: 'STARTER',
  webEditor: 'STARTER',
  pythonNotebook: 'PRO',
  proctoring: 'STARTER',
  aiExams: 'PRO',
  bulkImport: 'PRO',
  whiteLabel: 'ENTERPRISE',
  customDomain: 'ENTERPRISE',
  impersonation: 'STARTER',
  advancedAnalytics: 'PRO',
  tabSwitch: 'PRO',
  ipTracking: 'PRO',
  apiAccess: 'PRO',
  certificates: 'STARTER',
  subdomain: 'ENTERPRISE',
  customSlug: 'ENTERPRISE',
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimitConfig> = {
  FREE: {
    students: 50,
    courses: 2,
    examsPerMonth: 2,
    storageMb: 500,
    adminSeats: 0,
    teacherSeats: 0,
    seats: 1,
    modulesPerCourse: 3,
    examsPerCourse: 1,
    codeExecs: 100,
    allowedQuestionTypes: ['mcq', 'multiselect', 'reading'],
  },
  STARTER: {
    students: 200,
    courses: 15,
    examsPerMonth: 10,
    storageMb: 5120,
    adminSeats: 2,
    teacherSeats: 3,
    seats: 5,
    modulesPerCourse: 20,
    examsPerCourse: 10,
    codeExecs: 5000,
    allowedQuestionTypes: ['*'],
  },
  PRO: {
    students: 1000,
    courses: 30,
    examsPerMonth: 20,
    storageMb: 51200,
    adminSeats: 5,
    teacherSeats: 10,
    seats: 15,
    modulesPerCourse: UNLIMITED,
    examsPerCourse: UNLIMITED,
    codeExecs: 50000,
    allowedQuestionTypes: ['*'],
  },
  ENTERPRISE: {
    students: UNLIMITED,
    courses: UNLIMITED,
    examsPerMonth: UNLIMITED,
    storageMb: UNLIMITED,
    adminSeats: UNLIMITED,
    teacherSeats: UNLIMITED,
    seats: UNLIMITED,
    modulesPerCourse: UNLIMITED,
    examsPerCourse: UNLIMITED,
    codeExecs: UNLIMITED,
    allowedQuestionTypes: ['*'],
  },
};

export const PLAN_FEATURES: Record<PlanKey, PlanFeatureConfig> = {
  FREE: {
    coding: false,
    webEditor: false,
    pythonNotebook: false,
    proctoring: false,
    aiExams: false,
    bulkImport: false,
    whiteLabel: false,
    customDomain: false,
    impersonation: false,
    advancedAnalytics: false,
    tabSwitch: false,
    ipTracking: false,
    apiAccess: false,
    certificates: false,
    subdomain: false,
    customSlug: false,
  },
  STARTER: {
    coding: true,
    webEditor: true,
    pythonNotebook: false,
    proctoring: true,
    aiExams: false,
    bulkImport: false,
    whiteLabel: false,
    customDomain: false,
    impersonation: true,
    advancedAnalytics: false,
    tabSwitch: false,
    ipTracking: false,
    apiAccess: false,
    certificates: true,
    subdomain: false,
    customSlug: false,
  },
  PRO: {
    coding: true,
    webEditor: true,
    pythonNotebook: true,
    proctoring: true,
    aiExams: false,
    bulkImport: true,
    whiteLabel: false,
    customDomain: false,
    impersonation: true,
    advancedAnalytics: true,
    tabSwitch: true,
    ipTracking: true,
    apiAccess: true,
    certificates: true,
    subdomain: false,
    customSlug: false,
  },
  ENTERPRISE: {
    coding: true,
    webEditor: true,
    pythonNotebook: true,
    proctoring: true,
    aiExams: false,
    bulkImport: true,
    whiteLabel: true,
    customDomain: true,
    impersonation: true,
    advancedAnalytics: true,
    tabSwitch: true,
    ipTracking: true,
    apiAccess: true,
    certificates: true,
    subdomain: true,
    customSlug: true,
  },
};

export const PLAN_PRICE_MAP: Record<PlanKey, string | null> = {
  FREE: null,
  STARTER: 'STRIPE_PRICE_STARTER',
  PRO: 'STRIPE_PRICE_PRO',
  ENTERPRISE: 'STRIPE_PRICE_ENTERPRISE',
};

export function getEffectivePlanLimits(
  plan: PlanKey,
  rawFeatures?: unknown,
): PlanLimitConfig {
  const base = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

  const features =
    rawFeatures && typeof rawFeatures === 'object' && !Array.isArray(rawFeatures)
      ? (rawFeatures as Record<string, unknown>)
      : {};

  const rawOverrides =
    features.limitsOverrides &&
    typeof features.limitsOverrides === 'object' &&
    !Array.isArray(features.limitsOverrides)
      ? (features.limitsOverrides as Record<string, unknown>)
      : {};

  const normalizedOverrides: Partial<PlanLimitConfig> = {};
  for (const key of LIMIT_OVERRIDE_KEYS) {
    const value = rawOverrides[key];
    if (key === 'allowedQuestionTypes') {
      continue;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric) && Number.isInteger(numeric) && numeric >= -1) {
      normalizedOverrides[key] = numeric;
    }
  }

  const allowedQuestionTypes = Array.isArray(rawOverrides.allowedQuestionTypes)
    ? rawOverrides.allowedQuestionTypes
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
    : null;

  return {
    ...base,
    ...normalizedOverrides,
    allowedQuestionTypes:
      allowedQuestionTypes && allowedQuestionTypes.length > 0
        ? allowedQuestionTypes
        : base.allowedQuestionTypes,
  };
}

function requiresOrg(feature: string): boolean {
  return ORG_ONLY_PLAN_FEATURES.has(feature as keyof PlanFeatureConfig);
}

function isFreeOrgless(plan: PlanKey, orgId?: string | null): boolean {
  return plan === 'FREE' && !String(orgId || '').trim();
}

export function getRequiredPlanForFeature(feature: string): PlanKey {
  return FEATURE_REQUIRED_PLAN[feature] || 'PRO';
}
