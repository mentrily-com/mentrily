import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getClerkToken } from '../lib/clerk-token';

// Trailing slash must be stripped before appending the namespace below —
// "host.com//ns" is a different, invalid namespace to the server than
// "host.com/ns" (see useExamSocket.ts).
const SOCKET_URL = (
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
    'http://localhost:4000'
).replace(/\/+$/, '');

export interface AnnouncementEvent {
    id: string;
    title: string;
    content: string;
    attachments: any;
    teacherName: string;
    groupNames: string[];
    createdAt: string;
}

/**
 * Hook to listen for real-time announcement notifications.
 * Connects to the /notifications WebSocket namespace.
 */
export const useNotificationSocket = (onNewAnnouncement?: (announcement: AnnouncementEvent) => void) => {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const callbackRef = useRef(onNewAnnouncement);

    // Keep callback ref fresh
    useEffect(() => {
        callbackRef.current = onNewAnnouncement;
    }, [onNewAnnouncement]);

    useEffect(() => {
        let cancelled = false;

        const connect = async () => {
            // The socket connects to a different origin than the app in
            // production (an AWS API Gateway domain, not www.mentrily.com),
            // so withCredentials alone can never authenticate it — a cookie
            // scoped to mentrily.com is never sent to a request targeting a
            // different domain. Attach a bearer token explicitly, same as
            // REST calls (see lib/clerk-token.ts).
            const token = await getClerkToken();
            if (cancelled) return;

            const socket = io(`${SOCKET_URL}/notifications`, {
                // See useExamSocket.ts: the production API Gateway (HTTP API,
                // not a WebSocket API) can't perform a WS upgrade at all, so
                // 'websocket'-only here meant this socket could never connect
                // in production. Force long-polling instead.
                transports: ['polling'],
                upgrade: false,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 3000,
                withCredentials: true,
                auth: token ? { token } : undefined,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('[NotificationSocket] Connected');
                setIsConnected(true);
            });

            socket.on('new_announcement', (data: AnnouncementEvent) => {
                console.log('[NotificationSocket] New announcement:', data.title);
                callbackRef.current?.(data);
            });

            socket.on('disconnect', (reason) => {
                console.log('[NotificationSocket] Disconnected:', reason);
                setIsConnected(false);
            });
        };

        void connect();

        return () => {
            cancelled = true;
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, []);

    const disconnect = useCallback(() => {
        socketRef.current?.disconnect();
    }, []);

    return { isConnected, disconnect };
};
