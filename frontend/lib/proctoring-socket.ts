// Where the /proctoring namespace lives. NEXT_PUBLIC_PROCTORING_WS_URL points
// it at go-connector; unset, it falls back to the Nest gateway. Trailing
// slashes are stripped: "host.com//proctoring" is a different, invalid
// namespace to the server than "host.com/proctoring".
export const PROCTORING_SOCKET_URL = (
    process.env.NEXT_PUBLIC_PROCTORING_WS_URL ||
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
    'http://localhost:4000'
).replace(/\/+$/, '');

// Production's API Gateway HTTP API can't upgrade to WebSocket, so the default
// stays long-polling. Behind a WS-capable endpoint set "websocket,polling":
// websocket first, polling only if it fails (tryAllTransports).
export const PROCTORING_TRANSPORTS = (process.env.NEXT_PUBLIC_PROCTORING_TRANSPORTS || 'polling')
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is 'polling' | 'websocket' => t === 'polling' || t === 'websocket');

export const proctoringSocketOptions = {
    transports: PROCTORING_TRANSPORTS.length > 0 ? PROCTORING_TRANSPORTS : ['polling'],
    upgrade: false,
    tryAllTransports: true,
    withCredentials: true,
};
