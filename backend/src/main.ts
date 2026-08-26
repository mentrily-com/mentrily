import './tracer';
import { NestFactory } from '@nestjs/core';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ArgumentsHost, Logger, ValidationPipe } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import helmet from '@fastify/helmet';
import { randomBytes } from 'crypto';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import {
  getAllowedWebOrigins,
  isAllowedSubdomainOrigin,
} from './config/app-brand';

process.env.TZ = process.env.TZ || 'Asia/Kathmandu';

class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly sentryEnabled: boolean,
    applicationRef: any,
  ) {
    super(applicationRef);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (this.sentryEnabled) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';
  const sentryDsn =
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentryEnabled = Boolean(sentryDsn);

  if (sentryEnabled) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      enabled: true,
    });
  }

  process.on('unhandledRejection', (reason) => {
    if (!sentryEnabled) return;
    Sentry.captureException(reason);
  });

  process.on('uncaughtException', (error) => {
    if (!sentryEnabled) return;
    Sentry.captureException(error);
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: !isProduction,
      bodyLimit: 10 * 1024 * 1024,
      trustProxy: true,
    }),
    {
      rawBody: true,
    },
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(sentryEnabled, httpAdapter));

  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', async (req: FastifyRequest) => {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    const xForwardedFor = req.headers['x-forwarded-for'];

    if (typeof cfConnectingIp === 'string' && !xForwardedFor) {
      req.headers['x-forwarded-for'] = cfConnectingIp;
    }
  });

  // Register plugin to allow Authorization header for CORS
  // @ts-ignore
  // Force reload
  await app.register(require('./fastify-cors-auth-header.plugin').default);

  // Register multipart support for file uploads. Only the certificate
  // signature endpoint still uploads through this backend (it needs
  // server-side sharp processing) — everything else uploads directly to S3
  // via presigned URLs (see UploadsModule), so this limit stays small.
  await app.register(require('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret)
    throw new Error('COOKIE_SECRET environment variable is missing.');

  // Register cookie support
  await app.register(require('@fastify/cookie'), {
    secret: cookieSecret,
    parseOptions: {},
  });

  await app.register(helmet, {
    global: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
  });

  const csrfExemptPaths = new Set<string>([
    '/api/auth/webhooks/clerk',
    '/api/billing/stripe/webhook',
  ]);
  const csrfCookieName = 'csrf_token';
  fastifyInstance.addHook(
    'preHandler',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const method = String(req.method || '').toUpperCase();
      const isStateChangingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
        method,
      );
      const requestPath = String(req.url || '').split('?')[0];

      if (!isStateChangingMethod) {
        const existingToken = (
          (req as any).cookies as Record<string, string> | undefined
        )?.[csrfCookieName];
        if (!existingToken) {
          (reply as any).setCookie(
            csrfCookieName,
            randomBytes(32).toString('hex'),
            {
              path: '/',
              sameSite: 'lax',
              httpOnly: false,
              secure: isProduction,
              maxAge: 60 * 60 * 24 * 30,
            },
          );
        }
        return;
      }

      if (csrfExemptPaths.has(requestPath)) {
        return;
      }

      const requestCookies =
        ((req as any).cookies as Record<string, string> | undefined) || {};
      const hasAuthCookie = Boolean(
        requestCookies.__session || requestCookies.auth_token,
      );
      if (!hasAuthCookie) {
        return;
      }

      const cookieToken = requestCookies[csrfCookieName];
      const headerToken = req.headers['x-csrf-token'];
      const normalizedHeaderToken = Array.isArray(headerToken)
        ? headerToken[0]
        : headerToken;

      if (
        !cookieToken ||
        !normalizedHeaderToken ||
        cookieToken !== normalizedHeaderToken
      ) {
        return reply.code(403).send({ message: 'Invalid CSRF token' });
      }
    },
  );

  // Register compression for performance (gzip/brotli)
  await app.register(require('@fastify/compress'), {
    global: true,
    encodings: ['br', 'gzip', 'deflate'],
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable CORS for Electron and Web clients
  app.enableCors({
    // Dynamic origin to support both localhost and production Vercel apps
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedWebOrigins(!isProduction);

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Support all subdomains of the configured domain.
      if (isAllowedSubdomainOrigin(origin)) {
        return callback(null, true);
      }

      // Note: If dynamic preview domains are needed, they should be explicitly allowed via environment variables, not a wildcard.

      // In development, might want to be more lenient or log
      logger.warn(`Blocked CORS origin: ${origin}`);
      callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0', (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Application is listening on ${address}`);

    // Initialize PeerServer
    if (process.env.ENABLE_LOCAL_PEER_SERVER === 'true') {
      // Using require to avoid potential type issues if @types/peer is missing
      const { PeerServer } = require('peer');
      const peerServer = PeerServer({ port: 9001, path: '/peer' });
      console.log('PeerServer running on port 9001, path /peer');
    }
  });
}
bootstrap();
