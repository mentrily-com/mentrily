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
import { SupabaseService } from '../../services/supabase/supabase.service';
import { WsException } from '@nestjs/websockets';
import { verifyToken } from '@clerk/backend';
import { createAdapter } from '@socket.io/redis-adapter';
import { OnModuleDestroy } from '@nestjs/common';
import {
  getAllowedWebOrigins,
  isAllowedSubdomainOrigin,
} from '../../config/app-brand';

@WebSocketGateway({
  namespace: 'proctoring',
  // Keep connections alive through production reverse-proxies (nginx default
  // idle timeout is 60s). pingInterval must be shorter than proxy timeout.
  pingInterval: 20000, // server sends ping every 20s
  pingTimeout: 40000, // allow 40s for pong before closing
  // Upgrade from long-polling to websocket is fine, but lock it once upgraded
  transports: ['websocket', 'polling'],
  cors: {
    origin: (origin, callback) => {
      const isProduction = process.env.NODE_ENV === 'production';
      const allowedOrigins = getAllowedWebOrigins(!isProduction);

      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      if (isAllowedSubdomainOrigin(origin)) return callback(null, true);

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
})
export class MonitoringGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly submissionService: SubmissionService,
    private readonly supabase: SupabaseService,
  ) {}

  private get prisma() {
    return this.supabase.legacyPrisma;
  }

  @WebSocketServer()
  server: Server;

  private redisPubClient: Redis | null = null;
  private redisSubClient: Redis | null = null;

  private readonly violationCounterTtlSec = 6 * 60 * 60;

  private getTimeMeta() {
    const now = new Date();
    return {
      serverTimeMs: now.getTime(),
      serverTimeIso: now.toISOString(),
      timeZone: 'Asia/Kathmandu',
      utcOffsetMinutes: 345,
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
        const match = cookieHeader.match(/(?:^|;\s*)__session=([^;]*)/);
        if (match && match[1]) {
          return match[1];
        }
        const legacyMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
        if (legacyMatch && legacyMatch[1]) {
          return legacyMatch[1];
        }
      } catch (e) {
        console.warn('[MonitoringGateway] Error parsing cookies', e);
      }
    }

    console.log(
      '[MonitoringGateway] No token found in handshake, headers, or cookies.',
    );
    return null;
  }
  private activeConnections = new Map<
    string,
    { userId: string; examId: string }
  >(); // socketId -> Metadata

  private static readonly PRIVILEGED_ROLES = new Set([
    'TEACHER',
    'ADMIN',
    'SUPER_ADMIN',
  ]);

  /**
   * Server-side identity for socket handlers. The Clerk token only proves
   * *who* connected — role and DB user id must come from our own records,
   * never from event payloads (a student can put role: 'teacher' in
   * join_exam data). Memoized on the socket, Redis-cached across sockets.
   */
  private async getSocketUser(
    client: Socket,
  ): Promise<{ id: string; role: string } | null> {
    if (client.data.dbUser) {
      return client.data.dbUser;
    }

    const clerkId = String(client.data.userId || '');
    if (!clerkId) return null;

    const cacheKey = `user:socket-identity:${clerkId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        client.data.dbUser = JSON.parse(cached);
        return client.data.dbUser;
      }
    } catch {
      /* fall through to DB */
    }

    const user = await this.prisma.user.findFirst({
      where: { clerkId },
      select: { id: true, role: true },
    });

    if (!user) return null;

    const identity = { id: user.id, role: String(user.role || '') };
    client.data.dbUser = identity;
    await this.redis.set(cacheKey, JSON.stringify(identity), 'EX', 600);
    return identity;
  }

  private isPrivileged(role: string | undefined | null): boolean {
    return MonitoringGateway.PRIVILEGED_ROLES.has(
      String(role || '').toUpperCase(),
    );
  }

  private async getViolationCounts(
    sessionId: string,
  ): Promise<{ inCount: number; outCount: number }> {
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
          ? this.prisma.violation.count({
              where: { sessionId, type: 'TAB_SWITCH_IN' },
            })
          : Promise.resolve(inCount),
        needOut
          ? this.prisma.violation.count({
              where: {
                sessionId,
                type: { in: ['TAB_SWITCH', 'TAB_SWITCH_OUT'] },
              },
            })
          : Promise.resolve(outCount),
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

  private async incrementViolationCounter(
    sessionId: string,
    direction: 'in' | 'out',
  ): Promise<number> {
    const key =
      direction === 'in'
        ? `violation:count:in:${sessionId}`
        : `violation:count:out:${sessionId}`;

    // Single round-trip: INCR + refresh TTL together.
    const results = await this.redis
      .multi()
      .incr(key)
      .expire(key, this.violationCounterTtlSec)
      .exec();

    return Number(results?.[0]?.[1] ?? 0);
  }

  async afterInit(server: Server) {
    this.redisPubClient = this.redis.duplicate();
    this.redisSubClient = this.redis.duplicate();
    const ioTarget: any = server || this.server;
    const rootServer =
      typeof ioTarget?.adapter === 'function' ? ioTarget : ioTarget?.server;

    if (!rootServer || typeof rootServer.adapter !== 'function') {
      throw new Error('Socket.IO root server adapter API is unavailable');
    }

    rootServer.adapter(createAdapter(this.redisPubClient, this.redisSubClient));
    console.log('Proctoring Gateway initialized');
  }

  async onModuleDestroy() {
    await Promise.all([
      this.redisPubClient?.quit(),
      this.redisSubClient?.quit(),
    ]);
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token provided');

      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      client.data.userId = payload.sub;

      console.log(`Client connected and authenticated: ${client.id}`);
    } catch (error) {
      console.log(
        `Client connection rejected (unauthorized): ${client.id}`,
        error,
      );
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
      console.log(
        `Client disconnected: ${client.id} (User: ${meta.userId}, Exam: ${meta.examId})`,
      );

      // Notify teachers immediately
      this.server.to(`exam_${meta.examId}_monitor`).emit('student_status', {
        userId: meta.userId,
        online: false,
      });
    } else {
      console.log(`Client disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('join_exam')
  async handleJoinExam(
    @MessageBody()
    data: {
      examId: string;
      userId: string;
      role: string;
      deviceId?: string;
      tabId?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.examId || !data.userId) return { status: 'error' };

    // Identity and role come from the server, not the payload.
    const socketUser = await this.getSocketUser(client);
    if (!socketUser) {
      return { status: 'error', reason: 'UNAUTHENTICATED' };
    }

    const examRoom = `exam_${data.examId}`;
    client.join(examRoom);

    if (data.role === 'teacher') {
      // The monitor room streams every student's violations and status —
      // joining it requires a privileged role in OUR records.
      if (!this.isPrivileged(socketUser.role)) {
        console.warn(
          `[JoinExam] Blocked monitor join: user ${socketUser.id} claimed teacher but has role ${socketUser.role}`,
        );
        return { status: 'error', reason: 'FORBIDDEN' };
      }
      client.join(`${examRoom}_monitor`);
      console.log(`[JoinExam] Teacher ${socketUser.id} joined monitor`);
    } else {
      // Students may only join as themselves; the room name is derived from
      // the server-side user id so it can't be pointed at someone else.
      if (data.userId !== socketUser.id) {
        console.warn(
          `[JoinExam] Blocked student join: socket user ${socketUser.id} attempted to join as ${data.userId}`,
        );
        return { status: 'error', reason: 'FORBIDDEN' };
      }

      // Student logic - Takeover (Kick Out) Model
      const studentRoom = `student_${socketUser.id}_exam_${data.examId}`;

      // 1. SURGICAL KICK: Disconnect only OTHER sockets in this student's room
      const peers = await this.server.in(studentRoom).fetchSockets();

      for (const s of peers) {
        if (s.id !== client.id) {
          console.log(
            `[JoinExam] Surgical kick for old socket ${s.id} (user ${data.userId})`,
          );
          s.emit('error', {
            message:
              'Another instance of this exam is active. This session is now inactive.',
          });
          s.disconnect(true);
        }
      }

      // JOIN the room for future displacement
      client.join(studentRoom);
      this.activeConnections.set(client.id, {
        userId: data.userId,
        examId: data.examId,
      });

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
        online: true,
      });
    }
    return { status: 'joined' };
  }

  @SubscribeMessage('save_answer')
  async handleSaveAnswer(
    @MessageBody() data: { sessionId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    // Exam integrity: only the session's owner may write answers into it.
    const socketUser = await this.getSocketUser(client);
    if (!socketUser) {
      return { status: 'rejected', reason: 'UNAUTHENTICATED' };
    }
    const ownerId = await this.submissionService.getSessionOwner(
      data.sessionId,
    );
    if (!ownerId || ownerId !== socketUser.id) {
      console.warn(
        `[SaveAnswer] Blocked: user ${socketUser.id} attempted to write session ${data.sessionId}`,
      );
      return { status: 'rejected', reason: 'FORBIDDEN' };
    }

    // Stages the answer in a per-question Redis hash (atomic — no lost
    // updates between tabs) and schedules one coalesced DB flush for the
    // session. See SubmissionService.queueAnswer.
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
      ...this.getTimeMeta(),
    });

    return { status: 'alive' };
  }

  @SubscribeMessage('log_violation')
  async handleLogViolation(
    @MessageBody()
    data: {
      sessionId: string;
      examId: string;
      userId: string;
      type: string;
      message: string;
      details?: any;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // Exam integrity: violations may only be logged by the session's owner.
    // Otherwise anyone could spam TAB_SWITCH events with a victim's session
    // id until their exam auto-terminates.
    const socketUser = await this.getSocketUser(client);
    if (!socketUser) {
      return { status: 'rejected', reason: 'UNAUTHENTICATED' };
    }
    const ownerId = await this.submissionService.getSessionOwner(
      data.sessionId,
    );
    if (!ownerId || ownerId !== socketUser.id) {
      console.warn(
        `[LogViolation] Blocked: user ${socketUser.id} attempted to log against session ${data.sessionId}`,
      );
      return { status: 'rejected', reason: 'FORBIDDEN' };
    }
    // Identity in downstream events comes from the server, not the payload.
    data.userId = socketUser.id;

    // PERFORMANCE: Check Cache for Session Status & Limits
    const cacheKey = `session:status:${data.sessionId}`;
    const cachedData = await this.redis.get(cacheKey);

    // Parse cached data or init as null
    let sessionData: { status: string; tabSwitchLimit: number | null } =
      cachedData ? JSON.parse(cachedData) : null;

    if (!sessionData) {
      const examSession = await this.prisma.examSession.findUnique({
        where: { id: data.sessionId },
        select: {
          status: true,
          exam: { select: { tabSwitchLimit: true } },
        },
      });
      if (!examSession) {
        return { status: 'rejected', reason: 'Session not found' };
      }
      sessionData = {
        status: examSession.status,
        tabSwitchLimit: examSession.exam?.tabSwitchLimit || null,
      };
      // Cache for short duration as status can change
      await this.redis.set(cacheKey, JSON.stringify(sessionData), 'EX', 60);
    }

    const status = sessionData.status;

    // 1. BLOCK violations if session is already completed or terminated
    if (status === 'COMPLETED' || status === 'TERMINATED') {
      console.log(
        `[Proctoring] Rejected violation: Session ${data.sessionId} is ${status}`,
      );
      return { status: 'rejected', reason: 'Session inactive' };
    }

    // Save to DB (Fire and forget? No, wait for it to ensure consistency)
    await this.prisma.violation.create({
      data: {
        sessionId: data.sessionId,
        type: data.type,
        message: data.message,
        severity: 'WARNING',
        timestamp: new Date(),
      },
    });

    // OPTIMIZATION: Use Redis Atomic Counters for Tab Switches
    let { inCount: tabSwitchInCount, outCount: tabSwitchOutCount } =
      await this.getViolationCounts(data.sessionId);

    if (data.type === 'TAB_SWITCH_IN') {
      tabSwitchInCount = await this.incrementViolationCounter(
        data.sessionId,
        'in',
      );
    } else if (data.type === 'TAB_SWITCH' || data.type === 'TAB_SWITCH_OUT') {
      tabSwitchOutCount = await this.incrementViolationCounter(
        data.sessionId,
        'out',
      );
    }

    // 2. CHECK TAB SWITCH LIMIT (Auto-termination)
    const limit = sessionData.tabSwitchLimit;
    if (data.type === 'TAB_SWITCH_IN' && limit && tabSwitchInCount >= limit) {
      console.log(
        `[Proctoring] Auto-terminating session ${data.sessionId} for user ${data.userId} due to tab switch limit (${tabSwitchInCount}/${limit})`,
      );

      await this.prisma.$executeRaw`
                UPDATE "ExamSession"
                SET
                    "status" = 'TERMINATED',
                    "endTime" = NOW(),
                    "timeTakenSec" = GREATEST(EXTRACT(EPOCH FROM (NOW() - "startTime"))::INT, 0),
                    "updatedAt" = NOW()
                WHERE "id" = ${data.sessionId}
            `;

      await this.redis.set(
        cacheKey,
        JSON.stringify({
          status: 'TERMINATED',
          tabSwitchLimit: sessionData.tabSwitchLimit,
        }),
        'EX',
        60,
      );

      // Force kick student
      await this.forceTerminate(data.examId, data.userId);

      // Notify teachers about the termination
      this.server.to(`exam_${data.examId}_monitor`).emit('student_terminated', {
        userId: data.userId,
        reason: `Exceeded Tab Switch Limit (${limit})`,
      });

      return { status: 'terminated' };
    }

    this.server.to(`exam_${data.examId}_monitor`).emit('live_violation', {
      userId: data.userId,
      type: data.type,
      message: data.message,
      details: data.details,
      tabOuts: tabSwitchOutCount,
      tabIns: tabSwitchInCount,
      timestamp: new Date(),
    });

    return { status: 'recorded' };
  }

  @SubscribeMessage('request_stream')
  async handleRequestStream(
    @MessageBody()
    data: { targetUserId: string; examId: string; teacherPeerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Webcam streams are the most sensitive surface here: only verified
    // privileged roles may request one.
    const socketUser = await this.getSocketUser(client);
    if (!socketUser || !this.isPrivileged(socketUser.role)) {
      console.warn(
        `[Proctoring] Blocked stream request from user ${socketUser?.id || 'unknown'} (role: ${socketUser?.role || 'none'})`,
      );
      return { status: 'rejected', reason: 'FORBIDDEN' };
    }

    // Teacher requests stream from student
    // Broadcast to the specific student room
    const studentRoom = `student_${data.targetUserId}_exam_${data.examId}`;
    console.log(
      `[Proctoring] Streaming requested for user ${data.targetUserId} in exam ${data.examId} (Peer: ${data.teacherPeerId})`,
    );

    this.server.to(studentRoom).emit('cmd_request_stream', {
      teacherSocketId: client.id,
      teacherPeerId: data.teacherPeerId,
    });
    return { status: 'requested' };
  }

  async forceTerminate(examId: string, userId: string) {
    // 1. Broadcast error to student rooms (emit 'error' OR 'force_terminate' for robust handling)
    const studentRoom = `student_${userId}_exam_${examId}`;
    console.log(
      `[Proctoring] Force terminating user ${userId} in exam ${examId}`,
    );

    this.server.to(studentRoom).emit('error', {
      message: 'EXAM_TERMINATED',
    });

    // Also emit a specific event that isn't dependent on generic "error" handling
    this.server.to(studentRoom).emit('force_terminate', {
      message: 'EXAM_TERMINATED',
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
      console.error(
        '[Proctoring] Error clearing redis for terminated student:',
        e,
      );
    }

    this.activeConnections.forEach((meta, sid) => {
      if (meta.userId === userId) this.activeConnections.delete(sid);
    });
  }
}
