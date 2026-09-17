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
import { verifyToken } from '@clerk/backend';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import {
  closeSocketRedisAdapter,
  ensureSocketRedisAdapter,
} from '../common/socket-redis-adapter';
import { OnModuleDestroy } from '@nestjs/common';
import {
  getAllowedWebOrigins,
  isAllowedSubdomainOrigin,
} from '../../config/app-brand';

import { PrismaService } from '../../services/prisma/prisma.service';

@WebSocketGateway({
  namespace: 'notifications',
  pingInterval: 20000,
  pingTimeout: 40000,
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
export class NotificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server: Server;

  private installedAdapter = false;
  private rootServer: any = null;

  // Map socketId → userId for cleanup
  private connectedUsers = new Map<string, string>();

  private extractToken(client: Socket): string | null {
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      try {
        const match = cookieHeader.match(/(?:^|;\s*)__session=([^;]*)/);
        if (match && match[1]) return match[1];
        const legacyMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]*)/);
        if (legacyMatch && legacyMatch[1]) return legacyMatch[1];
      } catch (e) {
        console.warn('[NotificationGateway] Error parsing cookies', e);
      }
    }
    return null;
  }

  afterInit(server: Server) {
    const ioTarget: any = server || this.server;
    const rootServer =
      typeof ioTarget?.adapter === 'function' ? ioTarget : ioTarget?.server;

    // Shared across gateways: installing a second adapter on the same server
    // leaves the first one subscribed, so serverCount() over-counts and every
    // cluster-wide call (fetchSockets) waits for a reply that never arrives.
    this.installedAdapter = ensureSocketRedisAdapter(rootServer, this.redis);
    this.rootServer = rootServer;
    console.log('[NotificationGateway] Initialized');
  }

  async onModuleDestroy() {
    if (this.installedAdapter) {
      await closeSocketRedisAdapter(this.rootServer);
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token provided');

      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      const userId = payload.sub;

      // Store userId on socket data for later use
      client.data.userId = userId;
      this.connectedUsers.set(client.id, userId);

      // Join user-specific room so we can target by Clerk ID
      client.join(`user_${userId}`);

      // Also lookup internal database User ID and join that room
      try {
        const dbUser = await this.prisma.user.findFirst({
          where: {
            OR: [{ clerkId: userId }, { id: userId }],
          },
          select: { id: true },
        });
        if (dbUser && dbUser.id !== userId) {
          client.data.dbUserId = dbUser.id;
          client.join(`user_${dbUser.id}`);
        }
      } catch (dbErr) {
        console.warn(
          `[NotificationGateway] Could not resolve DB user for ${userId}:`,
          dbErr,
        );
      }

      console.log(
        `[NotificationGateway] User ${userId} connected (${client.id})`,
      );
    } catch (error) {
      console.log(`[NotificationGateway] Connection rejected: ${client.id}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      this.connectedUsers.delete(client.id);
      console.log(
        `[NotificationGateway] User ${userId} disconnected (${client.id})`,
      );
    }
  }

  /**
   * Called by TeacherService after creating an announcement.
   * Looks up all students in the target groups and emits to their rooms.
   */
  async broadcastAnnouncement(
    announcement: {
      id: string;
      title: string;
      content: string;
      attachments: any;
      teacherName: string;
      groupNames: string[];
      createdAt: Date;
    },
    studentIds: string[],
  ) {
    const roomIds = [...new Set(studentIds)].map(
      (studentId) => `user_${studentId}`,
    );
    if (roomIds.length === 0) {
      return;
    }

    this.server.to(roomIds).emit('new_announcement', announcement);

    console.log(
      `[NotificationGateway] Broadcast announcement "${announcement.title}" to ${roomIds.length} students`,
    );
  }

  /**
   * Client subscribes to this on dashboard load to confirm connection.
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { status: 'pong' };
  }

  notifyUser(userId: string, event: string, payload: any) {
    if (!userId || !event) return;
    this.server.to(`user_${userId}`).emit(event, payload);
  }
}
