import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const databaseUrl = process.env.DATABASE_URL;
        const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || '3';
        const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '20';
        const connectTimeout = process.env.PRISMA_CONNECT_TIMEOUT || '20';
        const usePgBouncer = process.env.PRISMA_PGBOUNCER === 'true';

        let safeDatabaseUrl = databaseUrl;

        if (databaseUrl) {
            try {
                const parsed = new URL(databaseUrl);

                if (!parsed.searchParams.has('connection_limit')) {
                    parsed.searchParams.set('connection_limit', connectionLimit);
                }
                if (!parsed.searchParams.has('pool_timeout')) {
                    parsed.searchParams.set('pool_timeout', poolTimeout);
                }
                if (!parsed.searchParams.has('connect_timeout')) {
                    parsed.searchParams.set('connect_timeout', connectTimeout);
                }
                if (usePgBouncer && !parsed.searchParams.has('pgbouncer')) {
                    parsed.searchParams.set('pgbouncer', 'true');
                }

                safeDatabaseUrl = parsed.toString();
            } catch {
                safeDatabaseUrl = databaseUrl;
            }
        }

        super(safeDatabaseUrl
            ? {
                datasources: {
                    db: {
                        url: safeDatabaseUrl,
                    },
                },
            }
            : undefined);
    }

    async onModuleInit() {
        const eagerConnect = String(process.env.PRISMA_EAGER_CONNECT || 'false').toLowerCase() === 'true';
        if (!eagerConnect) {
            console.log('[PrismaService] Skipping eager DB connect on startup (PRISMA_EAGER_CONNECT=false).');
            return;
        }

        const maxAttempts = Number(process.env.PRISMA_CONNECT_MAX_ATTEMPTS || 10);
        const baseDelayMs = Number(process.env.PRISMA_CONNECT_RETRY_DELAY_MS || 2000);

        const isRetryableConnectError = (error: unknown): boolean => {
            const message = String((error as any)?.message || '').toLowerCase();

            const nonRetryableHints = [
                'no such database',
                'database does not exist',
                'password authentication failed',
                'authentication failed',
                'invalid connection string',
                'unknown database',
            ];

            return !nonRetryableHints.some((hint) => message.includes(hint));
        };

        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.$connect();
                return;
            } catch (error) {
                lastError = error;
                if (!isRetryableConnectError(error)) {
                    console.error('[PrismaService] Non-retryable DB connection error detected. Failing fast.');
                    throw error;
                }

                const delayMs = baseDelayMs * attempt;
                console.error(`[PrismaService] Connect attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms...`);

                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
        }

        throw lastError;
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
