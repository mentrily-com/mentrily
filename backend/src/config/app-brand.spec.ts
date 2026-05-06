import { getPublicAppUrl } from './app-brand';

describe('getPublicAppUrl', () => {
  const originalEnv = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  afterEach(() => {
    process.env.FRONTEND_URL = originalEnv.FRONTEND_URL;
    process.env.APP_URL = originalEnv.APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  });

  it('prefers a non-local public URL over localhost FRONTEND_URL', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.APP_URL = 'https://mentrily.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://mentrily.com';

    expect(getPublicAppUrl()).toBe('https://mentrily.com');
  });

  it('falls back to the default public app URL when only localhost is configured', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.APP_URL = '';
    process.env.NEXT_PUBLIC_APP_URL = '';

    expect(getPublicAppUrl()).toBe('https://mentrily.com');
  });
});
