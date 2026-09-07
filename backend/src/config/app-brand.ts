const DEFAULT_APP_NAME = 'Mentrily';
export const DEFAULT_APP_DOMAIN = 'mentrily.com';
export const DEFAULT_APP_URL = `https://${DEFAULT_APP_DOMAIN}`;

function normalizeDomain(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/$/, '');
}

export function getAppName(): string {
  return (
    process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || DEFAULT_APP_NAME
  );
}

function getAppDomain(): string {
  return normalizeDomain(
    process.env.APP_DOMAIN ||
      process.env.NEXT_PUBLIC_APP_DOMAIN ||
      DEFAULT_APP_DOMAIN,
  );
}

export function getAppUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_APP_URL
  ).replace(/\/$/, '');
}

function isLocalOrigin(value?: string | null): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return (
    normalized.startsWith('http://localhost') ||
    normalized.startsWith('https://localhost') ||
    normalized.startsWith('http://127.0.0.1') ||
    normalized.startsWith('https://127.0.0.1')
  );
}

export function getPublicAppUrl(): string {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    DEFAULT_APP_URL,
  ]
    .map((value) =>
      String(value || '')
        .trim()
        .replace(/\/$/, ''),
    )
    .filter(Boolean);

  const nonLocalCandidate = candidates.find((value) => !isLocalOrigin(value));
  return nonLocalCandidate || candidates[0] || DEFAULT_APP_URL;
}

export function getAllowedWebOrigins(includeDevOrigins: boolean): string[] {
  const configuredDomain = getAppDomain();
  const configuredAppUrl = getAppUrl();
  const origins = new Set<string>([
    configuredAppUrl,
    `https://www.${configuredDomain}`,
    `https://${configuredDomain}`,
  ]);

  if (process.env.VERCEL_URL) {
    origins.add(`https://${normalizeDomain(process.env.VERCEL_URL)}`);
  }

  if (includeDevOrigins) {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('tauri://localhost');
    origins.add('http://localhost:1420');
  }

  return [...origins].filter(Boolean);
}

export function isAllowedSubdomainOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin.endsWith('.mentrily.com')) return true;

  const configuredDomain = getAppDomain();
  const escapedDomain = configuredDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subdomainRegex = new RegExp(
    `^https?:\\/\\/[a-zA-Z0-9-]+\\.${escapedDomain}$`,
  );

  return subdomainRegex.test(origin);
}
