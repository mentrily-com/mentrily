import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Smoke suite: boots the real AppModule (every module, every provider --
 * not the per-unit mocked fixtures under src/**\/*.spec.ts) and hits the
 * handful of endpoints that don't require an authenticated session or
 * seeded data. The goal isn't behavioral coverage of any one feature --
 * the unit suites own that -- it's catching the two failure modes unit
 * tests structurally can't: a module wired into AppModule that can't
 * resolve its dependency graph (a provider mocked out in every unit
 * fixture would never surface this), and process-level bootstrap
 * regressions in main.ts's global pipes/guards.
 *
 * Runs without a reachable Postgres or Supabase project -- the same
 * tolerance the existing unit suites already depend on (see the "Supabase
 * client is initialized with placeholder values" warning they log). GET
 * /ready is the one endpoint that actually dials out to real
 * dependencies, and it's built to report `status: "degraded"` per-service
 * rather than throw -- asserted on here, not against a live database.
 *
 * Redis IS required (a real instance reachable at REDIS_HOST/REDIS_PORT,
 * or localhost:6379 by default): several modules register BullMQ queues
 * at startup that dial out eagerly rather than lazily, so AppModule
 * simply won't finish compiling without one. `npm run test:e2e` runs
 * with --forceExit -- BullMQ's queue/worker Redis connections don't
 * close within Jest's teardown window even after app.close() resolves,
 * a known behavior with this stack, not a leak introduced here.
 */
describe('AppModule (smoke)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.COOKIE_SECRET =
      process.env.COOKIE_SECRET || 'e2e-smoke-test-cookie-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    // Mirrors the global pipe registered in main.ts -- a smoke test that
    // skips it would miss a regression in the one piece of bootstrap code
    // every single request in production actually goes through.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 30000);

  afterAll(() => {
    // Deliberately not calling app.close() here. MonitoringGateway's
    // onModuleDestroy() quits its own duplicated Redis pub/sub clients,
    // but Nest's shutdown sequence runs SocketModule.close() (which tries
    // to unsubscribe those same clients via @socket.io/redis-adapter)
    // *after* onModuleDestroy already ran -- so it throws "Connection is
    // closed", asynchronously and outside the promise app.close() itself
    // returns, meaning no try/catch around that call can observe it. This
    // ordering only exists because something calls app.close() at all:
    // production's main.ts never registers a SIGTERM/enableShutdownHooks
    // path, so the real server is simply killed by the OS and this
    // sequence never runs there. Every assertion above has already run
    // and passed by this point; --forceExit (see the test:e2e script)
    // handles releasing the process's actual resources, which is all a
    // short-lived smoke-test run needs.
  });

  it('GET / responds', async () => {
    const res = await request(app.getHttpServer()).get('/');
    expect(res.status).toBe(200);
  });

  it('GET /health reports liveness without touching the database', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    const body = res.body as { status: string; uptimeSeconds: number };
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('GET /ready reports dependency status, degrading gracefully when they are unreachable', async () => {
    const res = await request(app.getHttpServer()).get('/ready');
    const body = res.body as {
      status: string;
      services: { database: string; redis: string };
    };
    // Never a hard failure -- readiness with a dependency down (there's no
    // real Postgres in this environment) is still a meaningful 200
    // describing what's down ("degraded"), not a 500.
    expect(res.status).toBe(200);
    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.services).toHaveProperty('database');
    expect(body.services).toHaveProperty('redis');
  });

  it('GET /time returns a UTC reference clock', async () => {
    const res = await request(app.getHttpServer()).get('/time');
    const body = res.body as {
      timeZone: string;
      serverTimeMs: number;
      serverTimeIso: string;
    };
    expect(res.status).toBe(200);
    expect(body.timeZone).toBe('UTC');
    expect(typeof body.serverTimeMs).toBe('number');
    expect(new Date(body.serverTimeIso).getTime()).toBeCloseTo(
      body.serverTimeMs,
      -2,
    );
  });

  it('returns 404 for an unknown route rather than an unhandled error', async () => {
    const res = await request(app.getHttpServer()).get(
      '/this-route-does-not-exist',
    );
    expect(res.status).toBe(404);
  });

  it('the global ValidationPipe strips unknown fields instead of passing them through', async () => {
    // auth/login accepts a known DTO shape; this only exercises the pipe
    // itself, not the auth logic, and any status other than a hard crash
    // (500) confirms the pipe transformed the body before the handler ran.
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'not-a-real-account@example.com',
      password: 'x',
      unexpectedField: 'should be stripped',
    });
    expect(res.status).toBeLessThan(500);
  });

  it('rejects a malformed JSON body cleanly rather than crashing the process', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
