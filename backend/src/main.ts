import './tracer';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

process.env.TZ = process.env.TZ || 'Asia/Kathmandu';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({
            logger: process.env.NODE_ENV !== 'production',
            bodyLimit: 600 * 1024 * 1024 // 600MB (to accommodate 500MB video uploads)
        })
    );



    // Register plugin to allow Authorization header for CORS
    // @ts-ignore
    // Force reload
    await app.register(require('./fastify-cors-auth-header.plugin').default);

    // Register multipart support for file uploads
    await app.register(require('@fastify/multipart'), {
        limits: {
            fileSize: 500 * 1024 * 1024, // 500MB (to support course video uploads)
        },
    });

    const cookieSecret = process.env.COOKIE_SECRET;
    if (!cookieSecret) throw new Error('COOKIE_SECRET environment variable is missing.');

    // Register cookie support
    await app.register(require('@fastify/cookie'), {
        secret: cookieSecret,
        parseOptions: {}
    });

    // Register compression for performance (gzip/brotli)
    await app.register(require('@fastify/compress'), {
        global: true,
        encodings: ['br', 'gzip', 'deflate']
    });

    // Set global API prefix
    app.setGlobalPrefix('api');

    // Enable CORS for Electron and Web clients
    app.enableCors({
        // Dynamic origin to support both localhost and production Vercel apps
        origin: (origin, callback) => {
            const configuredDomain = String(
                process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || 'blockscode.me'
            )
                .trim()
                .toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/:\d+$/, '');

            const allowedOrigins = [
                'https://blockscode-production.vercel.app',
                `https://www.${configuredDomain}`,
                `https://${configuredDomain}`
            ];

            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            // Check if origin is in the allowed list
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // Support all subdomains of the configured domain.
            const escapedDomain = configuredDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const subdomainRegex = new RegExp(`^https?:\\/\\/[a-zA-Z0-9-]+\\.${escapedDomain}$`);
            if (subdomainRegex.test(origin)) {
                return callback(null, true);
            }

            // Note: If dynamic preview domains are needed, they should be explicitly allowed via environment variables, not a wildcard.

            // In development, might want to be more lenient or log
            console.log('Blocked CORS:', origin);
            callback(null, false);
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Global Validation Pipe
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
    }));

    await app.listen(process.env.PORT ?? 3000, '0.0.0.0', (err, address) => {
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
