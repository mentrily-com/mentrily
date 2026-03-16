import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SubmissionService } from '../submission/submission.service';
import { PrismaService } from '../../services/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

@WebSocketGateway({
    namespace: 'proctoring',
    // Keep connections alive through production reverse-proxies (nginx default
    // idle timeout is 60s). pingInterval must be shorter than proxy timeout.
    pingInterval: 20000,   // server sends ping every 20s
    pingTimeout: 40000,    // allow 40s for pong before closing
    // Upgrade from long-polling to websocket is fine, but lock it once upgraded
    transports: ['websocket', 'polling'],
    cors: {
        origin: (origin, callback) => {
            const configuredDomain = String(
                process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || 'blockscode.me',
            )
                .trim()
                .toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/:\d+$/, '');

            const allowedOrigins = [
                'http://localhost:3000',
                'https://blockscode-production.vercel.app',
                'tauri://localhost',
                'http://localhost:1420',
                `https://www.${configuredDomain}`,
                `https://${configuredDomain}`,
            ];

            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);

            const escapedDomain = configuredDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const subdomainRegex = new RegExp(`^https?:\\/\\/[a-zA-Z0-9-]+\\.${escapedDomain}$`);
            if (subdomainRegex.test(origin)) return callback(null, true);

            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true
    },
})
export class MonitoringGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        @InjectRedis() private readonly redis: Redis,
        private readonly submissionService: SubmissionService,
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) { }

    @WebSocketServer()
    server: Server;

    private readonly violationCounterTtlSec = 6 * 60 * 60;

    private getTimeMeta() {
        const now = new Date();
        return {
            serverTimeMs: now.getTime(),
            serverTimeIso: now.toISOString(),
            timeZone: 'Asia/Kathmandu',
            utcOffsetMinutes: 345
        };
    }

    private extractToken(client: Socket): string | null {
        // 1. Try auth handshake
        if (client.handshake.auth && client.handshake.auth.token) {
            return client.handshake.auth.token;
        }

        // 2. Try headers (Authorization: Bearer ...)
        const authHeader = client.handshake.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.split(' ')[1];
        }

        // 3. Try cookies using robust regex or simple split
        const cookieHeader = client.handshake.headers.cookie;
        if (cookieHeader) {
            try {
                // Look for 'auth_token=' in the cookie string
                const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
                if (match && match[1]) {
                    return match[1];
                }
            } catch (e) {
                console.warn('[MonitoringGateway] Error parsing cookies', e);
            }
        }

        console.log('[MonitoringGateway] No token found in handshake, headers, or cookies.');
        return null;
    }
    private activeConnections = new Map<string, { userId: string; examId: string }>(); // socketId -> Metadata

    private async getViolationCounts(sessionId: string): Promise<{ inCount: number; outCount: number }> {
        const keyIn = `violation:count:in:${sessionId}`;
        const keyOut = `violation:count:out:${sessionId}`;

        const [cachedIn, cachedOut] = await this.redis.mget(keyIn, keyOut);

        let inCount = cachedIn ? Number(cachedIn) : NaN;
        let outCount = cachedOut ? Number(cachedOut) : NaN;

        const needIn = !Number.isFinite(inCount);
        const needOut = !Number.isFinite(outCount);

        if (needIn || needOut) {
            const [dbIn, dbOut] = await Promise.all([
                needIn
                    ? this.prisma.violation.count({ where: { sessionId, type: 'TAB_SWITCH_IN' } })
                    : Promise.resolve(inCount),
                needOut
                    ? this.prisma.violation.count({ where: { sessionId, type: { in: ['TAB_SWITCH', 'TAB_SWITCH_OUT'] } } })
                    : Promise.resolve(outCount)
            ]);

            inCount = Number(dbIn);
            outCount = Number(dbOut);

            await this.redis
                .multi()
                .set(keyIn, String(inCount), 'EX', this.violationCounterTtlSec)
                .set(keyOut, String(outCount), 'EX', this.violationCounterTtlSec)
                .exec();
        }

        return { inCount, outCount };
    }

    private async incrementViolationCounter(sessionId: string, direction: 'in' | 'out'): Promise<number> {
        const key = direction === 'in'
            ? `violation:count:in:${sessionId}`
            : `violation:count:out:${sessionId}`;

        const next = await this.redis.incr(key);
        const ttl = await this.redis.ttl(key);
        if (ttl < 0) {
            await this.redis.expire(key, this.violationCounterTtlSec);
        }

        return next;
    }

    afterInit(server: Server) {
        console.log('Proctoring Gateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            const token = this.extractToken(client);
            if (!token) throw new Error('No token provided');

            const payload = this.jwtService.verify(token);
            client.data.userId = payload.sub;

            console.log(`Client connected and authenticated: ${client.id}`);
        } catch (error) {
            console.log(`Client connection rejected (unauthorized): ${client.id}`, error);
            // Emit auth_error FIRST so the client knows WHY it's being disconnected
            // and can decide whether to retry (stale token) or redirect to login.
            client.emit('auth_error', { message: 'AUTH_FAILED' });
            // Small delay so the event is flushed before the transport closes
            setTimeout(() => client.disconnect(true), 100);
        }
    }

    async handleDisconnect(client: Socket) {
        const meta = this.activeConnections.get(client.id);
        if (meta) {
            this.activeConnections.delete(client.id);
            console.log(`Client disconnected: ${client.id} (User: ${meta.userId}, Exam: ${meta.examId})`);

            // Notify teachers immediately
            this.server.to(`exam_${meta.examId}_monitor`).emit('student_status', {
                userId: meta.userId,
                online: false
            });
        } else {
            console.log(`Client disconnected: ${client.id}`);
        }
    }

    @SubscribeMessage('join_exam')
    async handleJoinExam(
        @MessageBody() data: { examId: string; userId: string; role: string; deviceId?: string; tabId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        if (!data.examId || !data.userId) return { status: 'error' };

        const examRoom = `exam_${data.examId}`;
        client.join(examRoom);

        if (data.role === 'teacher') {
            client.join(`${examRoom}_monitor`);
            console.log(`[JoinExam] Teacher ${data.userId} joined monitor`);
        } else {
            // Student logic - Takeover (Kick Out) Model
            const studentRoom = `student_${data.userId}_exam_${data.examId}`;

            // 1. SURGICAL KICK: Disconnect only OTHER sockets in this student's room
            const peers = await this.server.in(studentRoom).fetchSockets();

            for (const s of peers) {
                if (s.id !== client.id) {
                    console.log(`[JoinExam] Surgical kick for old socket ${s.id} (user ${data.userId})`);
                    s.emit('error', {
                        message: 'Another instance of this exam is active. This session is now inactive.'
                    });
                    s.disconnect(true);
                }
            }

            // JOIN the room for future displacement
            client.join(studentRoom);
            this.activeConnections.set(client.id, { userId: data.userId, examId: data.examId });

            // 2. SET Redis ownership IMMEDIATELY
            // const identity = {
            //     deviceId: data.deviceId,
            //     tabId: data.tabId,
            //     socketId: client.id,
            //     joinedAt: Date.now()
            // };

            // await this.redis.set(
            //     `exam:${data.examId}:student:${data.userId}:online`,
            //     JSON.stringify(identity),
            //     'EX',
            //     120
            // );

            // Notify teachers
            this.server.to(`${examRoom}_monitor`).emit('student_status', {
                userId: data.userId,
                online: true
            });
        }
        return { status: 'joined' };
    }

    @SubscribeMessage('save_answer')
    async handleSaveAnswer(
        @MessageBody() data: { sessionId: string; answer: any },
        @ConnectedSocket() client: Socket,
    ) {
        // Immediate Redis cache for fast reads on page refresh/resume
        // This ensures answers are available even before the BullMQ job processes
        try {
            const redisKey = `session:answers:${data.sessionId}`;
            const existing = await this.redis.get(redisKey);
            const current = existing ? JSON.parse(existing) : {};
            const merged = { ...current, ...data.answer };
            // Cache for 6 hours (longer than most exams)
            await this.redis.set(redisKey, JSON.stringify(merged), 'EX', 21600);
        } catch (e) {
            console.error('[MonitoringGateway] Redis answer cache failed:', e);
        }

        // Queue for persistent DB save (async, may have slight delay)
        await this.submissionService.queueAnswer(data.sessionId, data.answer);
        return { status: 'saved' };
    }

    @SubscribeMessage('heartbeat')
    async handleHeartbeat(
        @MessageBody() data: { sessionId: string; timestamp: number },
        @ConnectedSocket() client: Socket,
    ) {
        // Can be used to track last seen timestamp in Redis for precise online status
        // await this.redis.set(`session:last_seen:${data.sessionId}`, Date.now(), 'EX', 60);
        
        // Emit explicit acknowledgement for client-side heartbeat tracking
        client.emit('heartbeat_ack', {
            timestamp: Date.now(),
            ...this.getTimeMeta()
        });
        
        return { status: 'alive' };
    }

    @SubscribeMessage('log_violation')
    async handleLogViolation(
        @MessageBody() data: {
            sessionId: string;
            examId: string;
            userId: string;
            type: string;
            message: string;
            details?: any;
        },
        @ConnectedSocket() client: Socket,
    ) {
        // PERFORMANCE: Check Cache for Session Status & Limits
        const cacheKey = `session:status:${data.sessionId}`;
        let cachedData = await this.redis.get(cacheKey);

        // Parse cached data or init as null
        let sessionData: { status: string; tabSwitchLimit: number | null } = cachedData ? JSON.parse(cachedData) : null;

        if (!sessionData) {
            const examSession = await this.prisma.examSession.findUnique({
                where: { id: data.sessionId },
                select: {
                    status: true,
                    exam: { select: { tabSwitchLimit: true } }
                }
            });
            if (!examSession) {
                return { status: 'rejected', reason: 'Session not found' };
            }
            sessionData = {
                status: examSession.status,
                tabSwitchLimit: examSession.exam?.tabSwitchLimit || null
            };
            // Cache for short duration as status can change
            await this.redis.set(cacheKey, JSON.stringify(sessionData), 'EX', 60);
        }

        const status = sessionData.status;

        // 1. BLOCK violations if session is already completed or terminated
        if (status === 'COMPLETED' || status === 'TERMINATED') {
            console.log(`[Proctoring] Rejected violation: Session ${data.sessionId} is ${status}`);
            return { status: 'rejected', reason: 'Session inactive' };
        }

        // Save to DB (Fire and forget? No, wait for it to ensure consistency)
        await this.prisma.violation.create({
            data: {
                sessionId: data.sessionId,
                type: data.type,
                message: data.message,
                severity: 'WARNING',
                timestamp: new Date()
            }
        });

        // OPTIMIZATION: Use Redis Atomic Counters for Tab Switches
        const keyIn = `violation:count:in:${data.sessionId}`;
        const keyOut = `violation:count:out:${data.sessionId}`;

        let { inCount: tabSwitchInCount, outCount: tabSwitchOutCount } = await this.getViolationCounts(data.sessionId);

        if (data.type === 'TAB_SWITCH_IN') {
            tabSwitchInCount = await this.incrementViolationCounter(data.sessionId, 'in');
        } else if (data.type === 'TAB_SWITCH' || data.type === 'TAB_SWITCH_OUT') {
            tabSwitchOutCount = await this.incrementViolationCounter(data.sessionId, 'out');
        }

        // 2. CHECK TAB SWITCH LIMIT (Auto-termination)
        const limit = sessionData.tabSwitchLimit;
        if (data.type === 'TAB_SWITCH_IN' && limit && tabSwitchInCount >= limit) {
            console.log(`[Proctoring] Auto-terminating session ${data.sessionId} for user ${data.userId} due to tab switch limit (${tabSwitchInCount}/${limit})`);

            await this.prisma.examSession.update({
                where: { id: data.sessionId },
                data: { status: 'TERMINATED', endTime: new Date() }
            });

            await this.redis.set(cacheKey, JSON.stringify({
                status: 'TERMINATED',
                tabSwitchLimit: sessionData.tabSwitchLimit
            }), 'EX', 60);

            // Force kick student
            await this.forceTerminate(data.examId, data.userId);

            // Notify teachers about the termination
            this.server
                .to(`exam_${data.examId}_monitor`)
                .emit('student_terminated', {
                    userId: data.userId,
                    reason: `Exceeded Tab Switch Limit (${limit})`
                });

            return { status: 'terminated' };
        }

        this.server
            .to(`exam_${data.examId}_monitor`)
            .emit('live_violation', {
                userId: data.userId,
                type: data.type,
                message: data.message,
                details: data.details,
                tabOuts: tabSwitchOutCount,
                tabIns: tabSwitchInCount,
                timestamp: new Date()
            });

        await this.redis
            .multi()
            .expire(keyIn, this.violationCounterTtlSec)
            .expire(keyOut, this.violationCounterTtlSec)
            .exec();

        return { status: 'recorded' };
    }

    @SubscribeMessage('request_stream')
    async handleRequestStream(
        @MessageBody() data: { targetUserId: string; examId: string; teacherPeerId: string },
        @ConnectedSocket() client: Socket,
    ) {
        // Teacher requests stream from student
        // Broadcast to the specific student room
        const studentRoom = `student_${data.targetUserId}_exam_${data.examId}`;
        console.log(`[Proctoring] Streaming requested for user ${data.targetUserId} in exam ${data.examId} (Peer: ${data.teacherPeerId})`);

        this.server.to(studentRoom).emit('cmd_request_stream', {
            teacherSocketId: client.id,
            teacherPeerId: data.teacherPeerId
        });
        return { status: 'requested' };
    }

    async forceTerminate(examId: string, userId: string) {
        // 1. Broadcast error to student rooms (emit 'error' OR 'force_terminate' for robust handling)
        const studentRoom = `student_${userId}_exam_${examId}`;
        console.log(`[Proctoring] Force terminating user ${userId} in exam ${examId}`);

        this.server.to(studentRoom).emit('error', {
            message: 'EXAM_TERMINATED'
        });

        // Also emit a specific event that isn't dependent on generic "error" handling
        this.server.to(studentRoom).emit('force_terminate', {
            message: 'EXAM_TERMINATED'
        });

        // 2. Disconnect sockets with a slight delay to ensure message delivery
        setTimeout(async () => {
            try {
                const sockets = await this.server.in(studentRoom).fetchSockets();
                for (const s of sockets) {
                    s.disconnect(true);
                }
            } catch (e) {
                console.error('[Proctoring] Error disconnecting sockets:', e);
            }
        }, 1000); // 1 second delay

        // 3. Clear Redis
        try {
            await this.redis.del(`exam:${examId}:student:${userId}:online`);
        } catch (e) {
            console.error('[Proctoring] Error clearing redis for terminated student:', e);
        }

        this.activeConnections.forEach((meta, sid) => {
            if (meta.userId === userId) this.activeConnections.delete(sid);
        });
    }
}
