import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
    'http://localhost:4000';

export interface AnnouncementEvent {
    id: string;
    title: string;
    content: string;
    attachments: any;
    teacherName: string;
    groupNames: string[];
    createdAt: string;
}

function getBrowserCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const raw = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`))
        ?.split('=')[1] || '';
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
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
        const wsAuthToken = getBrowserCookie('ws_auth_token') || getBrowserCookie('auth_token');

        const socket = io(`${SOCKET_URL}/notifications`, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 3000,
            withCredentials: true,
            auth: wsAuthToken ? { token: wsAuthToken } : undefined,
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

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const disconnect = useCallback(() => {
        socketRef.current?.disconnect();
    }, []);

    return { isConnected, disconnect };
};
