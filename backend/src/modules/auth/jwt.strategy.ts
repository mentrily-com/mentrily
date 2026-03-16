import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../services/prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly reservedSubdomains = new Set(['www', 'app', 'api', 'admin']);

    constructor(
        configService: ConfigService,
        private prisma: PrismaService,
        @InjectRedis() private readonly redis: Redis
    ) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET environment variable is not defined');
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req: any) => {
                    return req?.cookies?.auth_token || null;
                }
            ]),
            passReqToCallback: true,
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    private getRootDomain(): string {
        return String(
            process.env.APP_DOMAIN ||
            process.env.NEXT_PUBLIC_APP_DOMAIN ||
            ''
        )
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/:\d+$/, '');
    }

    private parseSubdomainFromHost(host?: string | null): string | null {
        const value = String(host || '')
            .trim()
            .toLowerCase()
            .replace(/:\d+$/, '');

        if (!value) return null;

        if (value === 'localhost' || value.endsWith('.localhost')) {
            const localParts = value.split('.');
            if (localParts.length > 1) {
                const localSubdomain = localParts[0] || null;
                if (!localSubdomain || this.reservedSubdomains.has(localSubdomain)) {
                    return null;
                }
                return localSubdomain;
            }
            return null;
        }

        const rootDomain = this.getRootDomain();
        if (!rootDomain || !value.endsWith(`.${rootDomain}`)) {
            return null;
        }

        const prefix = value.slice(0, -(`.${rootDomain}`.length));
        if (!prefix) return null;

        const subdomain = prefix.split('.')[0] || null;
        if (!subdomain || this.reservedSubdomains.has(subdomain)) {
            return null;
        }

        return subdomain;
    }

    private async resolveOrganizationIdBySubdomain(subdomain: string): Promise<string | null> {
        const key = `org:subdomain:${subdomain}`;
        const cached = await this.redis.get(key);
        if (cached) {
            const parsed = JSON.parse(cached);
            return parsed?.id || null;
        }

        const org = await this.prisma.organization.findFirst({
            where: {
                OR: [
                    { domain: { equals: subdomain, mode: 'insensitive' } },
                    { domain: { startsWith: `${subdomain}.`, mode: 'insensitive' } }
                ]
            },
            select: { id: true }
        });

        if (!org) {
            return null;
        }

        await this.redis.set(key, JSON.stringify(org), 'EX', 900);
        return org.id;
    }

    private async enforceTenantAccess(req: any, sessionUser: any): Promise<void> {
        const tenantSubdomainFromHeader = String(req?.headers?.['x-org-subdomain'] || '').trim().toLowerCase();
        const tenantHost = req?.headers?.['x-tenant-host'] || req?.headers?.host || null;
        const tenantSubdomain = tenantSubdomainFromHeader || this.parseSubdomainFromHost(tenantHost);

        if (!tenantSubdomain || sessionUser?.role === 'SUPER_ADMIN') {
            return;
        }

        const orgIdForSubdomain = await this.resolveOrganizationIdBySubdomain(tenantSubdomain);

        if (!orgIdForSubdomain) {
            throw new ForbiddenException('Organization not found for this subdomain');
        }

        if (!sessionUser?.orgId || sessionUser.orgId !== orgIdForSubdomain) {
            throw new ForbiddenException('You do not have access to this organization');
        }

        req.tenantOrgId = orgIdForSubdomain;
        req.tenantSubdomain = tenantSubdomain;
    }

    async validate(req: any, payload: any) {
        // PERFORMANCE: Cache user validation in Redis for 5 minutes
        // This reduces DB hits on every request from 1 to 0 (mostly)
        const cacheKey = `user:session:${payload.sub}`;
        const cached = await this.redis.get(cacheKey);

        if (cached) {
            const cachedUser = JSON.parse(cached);
            await this.enforceTenantAccess(req, cachedUser);
            return cachedUser;
        }

        // Real-time check if user is still active
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                isActive: true,
                orgId: true,
                profilePicture: true, // Fetch profile picture
                name: true,           // Fetch name too as it might be updated
                rollNumber: true,
                department: true,
                mustChangePassword: true,
                organization: {
                    select: {
                        features: true
                    }
                }
            }
        });

        if (!user || user.isActive === false) {
            throw new UnauthorizedException('ACCOUNT_SUSPENDED');
        }

        const sessionUser = {
            id: payload.sub,
            email: payload.email,
            name: user.name, // Include name
            role: payload.role,
            orgId: user.orgId,
            rollNumber: user.rollNumber,
            department: user.department,
            profilePicture: user.profilePicture, // Include profile picture
            features: user.organization?.features || {},
            mustChangePassword: user.mustChangePassword
        };

        await this.enforceTenantAccess(req, sessionUser);

        // Cache for 5 minutes (300 seconds)
        await this.redis.set(cacheKey, JSON.stringify(sessionUser), 'EX', 300);

        return sessionUser;
    }
}
