import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/main.ts',
    'src/**/*.module.ts',
    'src/**/*.controller.ts',
    'src/**/*.gateway.ts',
    'src/**/*.processor.ts',
    'src/**/*.service.ts',
    'src/**/*.decorator.ts',
    'src/**/*.guard.ts',
    'src/**/*.strategy.ts',
    'prisma/seed.ts',
  ],
  project: [
    'src/**/*.ts',
    'prisma/**/*.ts',
  ],
  ignoreDependencies: [
    '@types/express',
    '@types/sharp',
    '@types/supertest',
    'supertest',
  ],
};

export default config;
