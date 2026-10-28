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

        const connect = () => {
            if (cancelled) return;
            const socket = io(`${SOCKET_URL}/notifications`, {
                // websocket first; tryAllTransports falls back to long-polling
                // where the API Gateway (HTTP API) can't upgrade. Without it a
                // failed websocket never tried polling at all.
                transports: ['websocket', 'polling'],
                tryAllTransports: true,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 3000,
                withCredentials: true,
                // Cross-origin in production, so cookies never reach it; send a
                // bearer token (see lib/clerk-token.ts). A callback, not a fixed
                // value, so each reconnect gets a fresh ~60s Clerk token.
                auth: (cb) => {
                    getClerkToken().then(
                        (token) => cb(token ? { token } : {}),
                        () => cb({}),
                    );
                },
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

        connect();

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
