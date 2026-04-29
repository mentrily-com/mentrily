import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
  ],
  project: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'sentry.*.config.ts',
  ],
  ignoreDependencies: [
    'critters',
    'postcss',
    'tailwindcss',
    '@tailwindcss/typography',
  ],
};

export default config;
