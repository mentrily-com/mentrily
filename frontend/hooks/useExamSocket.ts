import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '../app/components/Common/Toast';
import { getClerkToken } from '../lib/clerk-token';
import { PROCTORING_SOCKET_URL, proctoringSocketOptions } from '../lib/proctoring-socket';
const HEARTBEAT_INTERVAL = 30000; // 30 s
const MAX_MISSED_HEARTBEATS = 3;
const MAX_RECONNECT_ATTEMPTS = 8; // total retries before giving up
const BASE_RECONNECT_DELAY = 2000; // 2 s base, doubles each attempt (capped)
const MAX_RECONNECT_DELAY = 30000; // 30 s cap
const SAVE_ACK_TIMEOUT = 5000;
const MAX_AUTH_RETRIES = 3; // fresh-token retries for go-connector's connect_error 'AUTH_FAILED'

function getBrowserCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const raw =
        document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
            ?.split('=')[1] || '';
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export const useExamSocket = (
    examId: string,
    userId: string,
    sessionId: string,
    isNotFound: boolean = false,
    options?: { requiresExamAuth?: boolean; authRedirectHref?: string },
) => {
    const socketRef = useRef<Socket | null>(null);
    const [activeSocket, setActiveSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [missedHeartbeats, setMissedHeartbeats] = useState(0);
    // 'idle'       = waiting for exam/user/session IDs before connecting
    // 'connecting' = waiting for first confirmed connect (or reconnecting)
    // 'connected'  = socket is live and joined the exam room
    // 'failed'     = all retry attempts exhausted before ever connecting
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');

    const { error: toastError, warning } = useToast();

    // --- Persistent refs (never stale in callbacks) ---
    const isKicked = useRef(false);
    // Violations raised while the socket is down (network blip, reconnect,
    // or before the first connect). They are emitted once it is back, so a
    // tab switch during that window is still recorded instead of vanishing.
    const pendingViolations = useRef<Record<string, unknown>[]>([]);
    const MAX_PENDING_VIOLATIONS = 200;
    // Answers saved while the socket is down, latest value per key. Emitting
    // only when connected used to drop them silently (e.g. a click before
    // the first connect, or during a reconnect).
    const pendingAnswers = useRef<Record<string, unknown>>({});
    const hasEverConnected = useRef(false); // tracks if socket confirmed connected at least once
    const connectedSessionId = useRef(''); // session that hasEverConnected refers to
    // Bumped on every initSocket/cleanup so a socket created after an awaited
    // token fetch can tell it has been superseded (orphan-socket race).
    const socketGeneration = useRef(0);
    const authRetries = useRef(0);
    const warnedRejections = useRef(new Set<string>());
    // serverTimeMs - Date.now(), refreshed from each heartbeat_ack; null until the first one.
    const serverOffsetRef = useRef<number | null>(null);
    const lastHeartbeatAck = useRef<number>(Date.now());
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const missedHeartbeatsRef = useRef(0); // ref mirror so callbacks read latest value
    const examIdRef = useRef(examId);
    const userIdRef = useRef(userId);
    const sessionIdRef = useRef(sessionId);
    const requiresExamAuthRef = useRef(options?.requiresExamAuth ?? true);
    const authRedirectHrefRef = useRef(options?.authRedirectHref || '');

    // Keep refs in sync with props
    useEffect(() => {
        examIdRef.current = examId;
    }, [examId]);
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);
    useEffect(() => {
        requiresExamAuthRef.current = options?.requiresExamAuth ?? true;
    }, [options?.requiresExamAuth]);
    useEffect(() => {
        authRedirectHrefRef.current = options?.authRedirectHref || '';
    }, [options?.authRedirectHref]);

    // --- Stable identity per device/tab ---
    const [identity] = useState(() => {
        if (typeof window === 'undefined') return { deviceId: 'unknown', tabId: 'unknown' };

        let dId = localStorage.getItem('deviceId');
        if (!dId) {
            dId = 'dev_' + Math.random().toString(36).substring(2, 12);
            localStorage.setItem('deviceId', dId);
        }

        let tId = sessionStorage.getItem('exam_tab_id');
        if (!tId) {
            tId = 'tab_' + Math.random().toString(36).substring(2, 12);
            sessionStorage.setItem('exam_tab_id', tId);
        }

        return { deviceId: dId, tabId: tId };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Redirect helpers
    // ─────────────────────────────────────────────────────────────────────────
    const redirectToLogin = useCallback((errorCode: string) => {
        const configuredHref = authRedirectHrefRef.current;
        if (configuredHref) {
            const separator = configuredHref.includes('?') ? '&' : '?';
            window.location.href = `${configuredHref}${separator}error=${encodeURIComponent(errorCode)}`;
            return;
        }
        window.location.href = `/exam/login?slug=${examIdRef.current}&error=${errorCode}`;
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Heartbeat management
    // ─────────────────────────────────────────────────────────────────────────
    const stopHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    const startHeartbeat = useCallback(
        (socket: Socket) => {
            stopHeartbeat();

            lastHeartbeatAck.current = Date.now();
            missedHeartbeatsRef.current = 0;
            setMissedHeartbeats(0);

            heartbeatIntervalRef.current = setInterval(() => {
                const sid = sessionIdRef.current;
                if (!sid || isKicked.current) return;

                if (socket.connected) {
                    socket.emit('heartbeat', { sessionId: sid, timestamp: Date.now() });

                    const timeSinceAck = Date.now() - lastHeartbeatAck.current;
                    if (timeSinceAck > HEARTBEAT_INTERVAL + 5000) {
                        missedHeartbeatsRef.current += 1;
                        setMissedHeartbeats(missedHeartbeatsRef.current);
                        console.warn(`[Socket] Missed heartbeat #${missedHeartbeatsRef.current}`);

                        if (missedHeartbeatsRef.current >= MAX_MISSED_HEARTBEATS) {
                            console.error('[Socket] Max missed heartbeats. Redirecting to login.');
                            stopHeartbeat();
                            warning('Connection lost. Please log in again.', 'Connection Issue', 3000);
                            setTimeout(() => redirectToLogin('connection_lost'), 1500);
                        }
                    }
                } else {
                    // Socket is disconnected — count against missed heartbeats
                    missedHeartbeatsRef.current += 1;
                    setMissedHeartbeats(missedHeartbeatsRef.current);
                    console.warn(`[Socket] Disconnected. Missed heartbeat #${missedHeartbeatsRef.current}`);

                    if (missedHeartbeatsRef.current >= MAX_MISSED_HEARTBEATS) {
                        console.error('[Socket] Max missed heartbeats (disconnected). Redirecting to login.');
                        stopHeartbeat();
                        warning('Connection lost. Please log in again.', 'Connection Issue', 3000);
                        setTimeout(() => redirectToLogin('connection_lost'), 1500);
                    }
                }
            }, HEARTBEAT_INTERVAL);
        },
        [stopHeartbeat, warning, redirectToLogin],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // save_answer with ack: timeouts/errors requeue, validation rejections don't
    // ─────────────────────────────────────────────────────────────────────────
    const latestSent = useRef<Record<string, unknown>>({});
    const saveRetryTimer = useRef<NodeJS.Timeout | null>(null);
    const emitSave = useCallback(
        (socket: Socket, answer: Record<string, unknown>, isBatch: boolean) => {
            const sid = sessionIdRef.current;
            if (!sid) {
                Object.assign(pendingAnswers.current, answer);
                return;
            }
            Object.assign(latestSent.current, answer);
            const onAck = (err: Error | null, res?: { status?: string; reason?: string }) => {
                if (isKicked.current || (!err && res?.status === 'saved')) return;

                if (err || res?.status !== 'rejected') {
                    // No ack: requeue, but never over a newer value queued or sent since.
                    for (const [k, v] of Object.entries(answer)) {
                        if (!(k in pendingAnswers.current) && latestSent.current[k] === v)
                            pendingAnswers.current[k] = v;
                    }
                    // Still connected (slow server): retry shortly; otherwise the
                    // connect handler flushes the queue.
                    if (!saveRetryTimer.current) {
                        saveRetryTimer.current = setTimeout(() => {
                            saveRetryTimer.current = null;
                            const live = socketRef.current;
                            const retry = pendingAnswers.current;
                            if (!live?.connected || Object.keys(retry).length === 0) return;
                            pendingAnswers.current = {};
                            emitSave(live, retry, true);
                        }, 2000);
                    }
                    return;
                }

                // Rejected: resending the same payload can't succeed. A batch that
                // is too big as a whole is split into per-key saves instead.
                const reason = res.reason || 'UNKNOWN';
                const keys = Object.keys(answer);
                if (isBatch && keys.length > 1 && (reason === 'TOO_MANY_ANSWERS' || reason === 'ANSWER_TOO_LARGE')) {
                    keys.forEach((k) => emitSave(socket, { [k]: answer[k] }, false));
                    return;
                }
                console.error(`[Socket] save_answer rejected (${reason})`, keys);
                if (!warnedRejections.current.has(reason)) {
                    warnedRejections.current.add(reason);
                    toastError(`An answer could not be saved (${reason}).`, 'Save Failed');
                }
            };
            socket.timeout(SAVE_ACK_TIMEOUT).emit('save_answer', { sessionId: sid, answer }, onAck);
        },
        [toastError],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Socket factory — creates a brand-new socket and wires all events
    // ─────────────────────────────────────────────────────────────────────────
    const initSocket = useCallback(async () => {
        if (isKicked.current) return;
        if (!examIdRef.current || !userIdRef.current) return;

        if (requiresExamAuthRef.current && typeof window !== 'undefined') {
            // sessionStorage (tab-scoped), matching exam/[slug]/page.tsx and
            // exam/login/page.tsx — this marker must not outlive the tab, or
            // a stale flag lets a fresh visit skip the exam login form.
            const examAuthKey = `exam_${examIdRef.current}_auth`;
            let examAuthMarker = sessionStorage.getItem(examAuthKey);

            if (!examAuthMarker) {
                const markerFromCookie = getBrowserCookie(examAuthKey);
                if (markerFromCookie) {
                    examAuthMarker = markerFromCookie;
                    sessionStorage.setItem(examAuthKey, markerFromCookie);
                }
            }

            if (!examAuthMarker) {
                console.warn('[Socket] Exam auth marker missing. Redirecting to exam login.');
                redirectToLogin('exam_auth_required');
                return;
            }
        }

        const generation = ++socketGeneration.current;
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        // The socket connects to a different origin than the app in
        // production (an AWS API Gateway domain, not www.mentrily.com), so
        // withCredentials alone can never authenticate it — a cookie scoped
        // to mentrily.com is never sent to a request targeting a completely
        // different domain, regardless of CORS/credentials settings. REST
        // calls avoid this by attaching a bearer token explicitly (see
        // lib/clerk-token.ts); do the same here so the gateway's
        // extractToken() has something to verify.
        const token = await getClerkToken();
        // A newer initSocket or the effect cleanup ran during the await.
        if (isKicked.current || generation !== socketGeneration.current) return;

        // Tear down the previous socket only now, so nothing can slip in between.
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const socket = io(`${PROCTORING_SOCKET_URL}/proctoring`, {
            // Transport choice (polling behind API Gateway, websocket behind
            // go-connector's endpoint) lives in lib/proctoring-socket.ts.
            ...proctoringSocketOptions,
            // Disable socket.io's built-in reconnection entirely — we manage it
            // ourselves so we can create a FRESH socket (required after
            // 'io server disconnect' which permanently sets skipReconnect).
            reconnection: false,
            auth: token ? { token } : undefined,
        });

        socketRef.current = socket;
        setActiveSocket(socket);

        // ── connect ─────────────────────────────────────────────────────────
        socket.on('connect', () => {
            console.log(`[Socket] Connected (${socket.id})`);
            reconnectAttempts.current = 0; // reset on successful connect
            authRetries.current = 0;
            hasEverConnected.current = true; // mark that we've confirmed a live connection
            connectedSessionId.current = sessionIdRef.current;
            setIsConnected(true);
            setConnectionStatus('connected');
            lastHeartbeatAck.current = Date.now();
            missedHeartbeatsRef.current = 0;
            setMissedHeartbeats(0);

            socket.emit('join_exam', {
                examId: examIdRef.current,
                userId: userIdRef.current,
                role: 'student',
                deviceId: identity.deviceId,
                tabId: identity.tabId,
                // Lets the server mark live presence at join so the submit guard
                // has a fresh signal before the first heartbeat lands.
                sessionId: sessionIdRef.current,
            });

            // Restart heartbeat bound to this fresh socket
            if (sessionIdRef.current) startHeartbeat(socket);

            if (Object.keys(pendingAnswers.current).length > 0 && sessionIdRef.current) {
                const answer = pendingAnswers.current;
                pendingAnswers.current = {};
                emitSave(socket, answer, true);
            }

            // Send anything captured while the socket was down, keeping the
            // time each one actually happened.
            if (pendingViolations.current.length > 0 && sessionIdRef.current) {
                const queued = pendingViolations.current;
                pendingViolations.current = [];
                console.warn(`[Socket] Flushing ${queued.length} queued violation(s)`);
                queued.forEach((violation) =>
                    socket.emit('log_violation', {
                        ...violation,
                        sessionId: sessionIdRef.current,
                        queued: true,
                    }),
                );
            }
        });

        // ── heartbeat ack ───────────────────────────────────────────────────
        socket.on('heartbeat_ack', (data?: { serverTimeMs?: number }) => {
            if (typeof data?.serverTimeMs === 'number') serverOffsetRef.current = data.serverTimeMs - Date.now();
            lastHeartbeatAck.current = Date.now();
            missedHeartbeatsRef.current = 0;
            setMissedHeartbeats(0);
        });

        // ── auth error (server rejects connection due to bad token) ──────────
        // We receive this BEFORE the server calls socket.disconnect(true),
        // so we know it's an auth failure, not a proxy kill.
        socket.on('auth_error', () => {
            console.error('[Socket] Auth error received. Token may have expired.');
            // Don't retry — the token is invalid. Send to login.
            isKicked.current = true;
            stopHeartbeat();
            redirectToLogin('auth_error');
        });

        // ── error (application-level, e.g. kicked / terminated) ─────────────
        socket.on('error', (data: any) => {
            console.error('[Socket] App error:', data);
            const msg: string = data?.message || '';

            if (
                msg.includes('Another instance') ||
                msg.includes('Another session') ||
                msg.includes('identity mismatch') ||
                msg.includes('New login')
            ) {
                isKicked.current = true;
                stopHeartbeat();
                toastError(msg || 'This session has been terminated due to another login.');
                socket.disconnect();
                setTimeout(() => redirectToLogin('duplicate_login'), 100);
            } else if (msg.includes('ACCOUNT_SUSPENDED')) {
                isKicked.current = true;
                stopHeartbeat();
                socket.disconnect();
                redirectToLogin('suspended');
            } else if (msg.includes('EXAM_TERMINATED')) {
                isKicked.current = true;
                stopHeartbeat();
                socket.disconnect();
                redirectToLogin('terminated');
            } else {
                toastError(msg || 'Connection Error');
            }
        });

        // ── force_terminate ─────────────────────────────────────────────────
        socket.on('force_terminate', () => {
            console.log('[Socket] force_terminate received');
            isKicked.current = true;
            stopHeartbeat();
            socket.disconnect();
            redirectToLogin('terminated');
        });

        // ── disconnect ──────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.warn(`[Socket] Disconnected: ${reason}`);
            setIsConnected(false);
            stopHeartbeat();

            // 1. Intentional kicks — do NOT reconnect
            if (isKicked.current) {
                console.log('[Socket] Kicked — no reconnect.');
                return;
            }

            // 2. io server disconnect — server explicitly closed the connection.
            //    socket.io sets skipReconnect=true internally so we MUST create
            //    a brand-new socket.  This also covers production proxy hard-kills.
            if (reason === 'io server disconnect') {
                setConnectionStatus('connecting');
                scheduleReconnect();
                return;
            }

            // 3. Network-level disconnect — schedule reconnect as well
            if (reason === 'transport close' || reason === 'ping timeout' || reason === 'transport error') {
                setConnectionStatus('connecting');
                scheduleReconnect();
                return;
            }

            // 4. io client disconnect (we called socket.disconnect()) — no reconnect
            console.log('[Socket] Client-side disconnect — no reconnect.');
        });

        // ── connect_error ───────────────────────────────────────────────────
        socket.on('connect_error', (err) => {
            console.error('[Socket] connect_error:', err.message);
            // go-connector reports a rejected token here rather than via 'auth_error'.
            // Tokens live ~60s, so retry a few times with a fresh one before giving up.
            if (err.message === 'AUTH_FAILED') {
                authRetries.current += 1;
                if (authRetries.current > MAX_AUTH_RETRIES) {
                    isKicked.current = true;
                    stopHeartbeat();
                    redirectToLogin('auth_error');
                    return;
                }
                setConnectionStatus('connecting');
                initSocket(); // fetches a fresh token
                return;
            }
            setIsConnected(false);
            setConnectionStatus('connecting');
            scheduleReconnect();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identity, startHeartbeat, stopHeartbeat, toastError, redirectToLogin, emitSave]);

    // ─────────────────────────────────────────────────────────────────────────
    // Reconnect scheduler — exponential backoff, fresh socket each time
    // ─────────────────────────────────────────────────────────────────────────
    const scheduleReconnect = useCallback(() => {
        if (isKicked.current) return;

        reconnectAttempts.current += 1;

        if (reconnectAttempts.current > MAX_RECONNECT_ATTEMPTS) {
            if (!hasEverConnected.current) {
                // Never successfully connected — show the error wall in the exam page
                // so the student can retry without losing their session.
                console.error('[Socket] Initial connection failed after max attempts. Showing error wall.');
                setConnectionStatus('failed');
            } else {
                // Was connected mid-exam, then permanently dropped — integrity
                // may be compromised, send back to login.
                console.error('[Socket] Lost connection permanently. Redirecting to login.');
                warning('Connection lost. Please log in again.', 'Connection Issue', 4000);
                setTimeout(() => redirectToLogin('connection_lost'), 1500);
            }
            return;
        }

        const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current - 1), MAX_RECONNECT_DELAY);

        console.log(`[Socket] Reconnect attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
            initSocket();
        }, delay);
    }, [warning, redirectToLogin, initSocket]);

    // ─────────────────────────────────────────────────────────────────────────
    // Main effect — initialise socket when params are ready
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!examId || !userId || !sessionId || isKicked.current || isNotFound) {
            setIsConnected(false);
            setConnectionStatus('idle');
            return;
        }

        // Reset all counters on clean init (e.g. userId just arrived after page load).
        // hasEverConnected survives for the same session so the full-page
        // skeleton can't come back mid-exam.
        reconnectAttempts.current = 0;
        if (connectedSessionId.current !== sessionId) hasEverConnected.current = false;
        setConnectionStatus('connecting');
        initSocket();

        return () => {
            // Component unmount — clean up without triggering reconnect
            socketGeneration.current += 1; // invalidates an initSocket still awaiting its token
            stopHeartbeat();
            if (saveRetryTimer.current) clearTimeout(saveRetryTimer.current);
            saveRetryTimer.current = null;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
        // Re-run only when the stable identity params change.
        // scheduleReconnect/initSocket are stable callbacks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examId, userId, sessionId, isNotFound]);

    // ─────────────────────────────────────────────────────────────────────────
    // Start heartbeat as soon as we have a sessionId + active socket
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeSocket && sessionId && activeSocket.connected && !isKicked.current) {
            startHeartbeat(activeSocket);
        }
        return stopHeartbeat;
    }, [activeSocket, sessionId, startHeartbeat, stopHeartbeat]);

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────
    const queueAnswer = useCallback(
        (key: string, value: unknown) => {
            if (isKicked.current) return;
            // A newer value supersedes any older one still waiting to be resent.
            delete pendingAnswers.current[key];
            if (socketRef.current?.connected && sessionIdRef.current) {
                emitSave(socketRef.current, { [key]: value }, false);
                return;
            }
            pendingAnswers.current[key] = value; // flushed on (re)connect
        },
        [emitSave],
    );

    const saveAnswer = useCallback((questionId: string, answer: any) => queueAnswer(questionId, answer), [queueAnswer]);

    const logViolation = useCallback((type: string, message: string, details?: any) => {
        if (isKicked.current) return;

        const violation = {
            sessionId: sessionIdRef.current,
            examId: examIdRef.current,
            userId: userIdRef.current,
            type,
            message,
            details,
            timestamp: new Date().toISOString(),
        };

        if (socketRef.current?.connected && sessionIdRef.current) {
            socketRef.current.emit('log_violation', violation);
            return;
        }

        // Offline or still connecting: hold it rather than drop it. The cap
        // keeps a long outage from growing this without bound.
        if (pendingViolations.current.length < MAX_PENDING_VIOLATIONS) {
            pendingViolations.current.push(violation);
        }
    }, []);

    const saveReviewStatus = useCallback(
        (questionId: string, isReviewed: boolean) => queueAnswer(`_rev_${questionId}`, isReviewed),
        [queueAnswer],
    );

    const disconnect = useCallback(() => {
        isKicked.current = true; // prevent auto-reconnect on manual disconnect
        stopHeartbeat();
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }
    }, [stopHeartbeat]);

    // Manual retry — used by the error wall in the exam page.
    // Resets all counters and creates a fresh socket.
    const retryConnection = useCallback(() => {
        if (isKicked.current) return;
        reconnectAttempts.current = 0;
        hasEverConnected.current = false;
        setConnectionStatus('connecting');
        initSocket();
    }, [initSocket]);

    return {
        socket: activeSocket,
        saveAnswer,
        logViolation,
        saveReviewStatus,
        disconnect,
        retryConnection,
        isConnected,
        connectionStatus,
        // Re-read every render; the 'connected' state update that sets it re-renders.
        hasConnected: hasEverConnected.current,
        missedHeartbeats,
        serverOffsetRef,
    };
};
