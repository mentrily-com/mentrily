import { useState, useEffect } from 'react';
import { API_BASE_URL, apiFetch } from '@/lib/api-base';

export interface NetworkStatus {
    isOnline: boolean;
    downlink: number; // Mbps
    effectiveType: string;
    rtt: number;
}

export function useNetworkMonitor() {
    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        downlink: 0,
        effectiveType: 'unknown',
        rtt: 0,
    });

    useEffect(() => {
        let intervalId: any = null;
        let cancelled = false;

        // The Network Information API's `downlink` is not a real measurement —
        // per spec browsers deliberately round it to a coarse set of buckets
        // and add random noise (fingerprinting mitigation), and only refresh
        // it every couple of seconds off a rolling average. Trusting it
        // directly (as this hook used to) shows a stale/inaccurate number
        // whenever it happens to be present. A real fetch against the actual
        // exam backend — what "true speed" means in this context — is the
        // only way to reflect the connection students are actually depending
        // on, so it's now the primary source and runs continuously, not just
        // as a fallback for when the native API is missing.
        const measureRealSpeed = async () => {
            if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.onLine) return;

            try {
                const startedAt = performance.now();
                const res = await apiFetch(`${API_BASE_URL}/exam/app-config?ts=${Date.now()}`, {
                    method: 'GET',
                    cache: 'no-store',
                });
                const text = await res.text();
                const endedAt = performance.now();
                if (cancelled) return;

                const durationSec = Math.max((endedAt - startedAt) / 1000, 0.05);

                // Estimate a simulated "Mbps" purely based on latency (RTT)
                // since the app-config payload is too small to measure true bandwidth.
                // Thresholds in UI are: [0, 2, 5, 10]
                let calculatedMbps = 0;
                if (durationSec <= 0.1)
                    calculatedMbps = 25; // 4 bars (Fast)
                else if (durationSec <= 0.25)
                    calculatedMbps = 8; // 3 bars (Good)
                else if (durationSec <= 0.5)
                    calculatedMbps = 4; // 2 bars (Fair)
                else calculatedMbps = 1; // 1 bar (Slow)

                if (calculatedMbps > 0) {
                    setStatus((prev) => ({
                        ...prev,
                        downlink: calculatedMbps,
                        rtt: Math.round(durationSec * 1000),
                    }));
                }
            } catch {
                if (!cancelled) {
                    setStatus((prev) => ({ ...prev, isOnline: false }));
                }
            }
        };

        const updateOnlineState = () => {
            const conn =
                (navigator as any).connection ||
                (navigator as any).mozConnection ||
                (navigator as any).webkitConnection;
            setStatus((prev) => ({
                ...prev,
                isOnline: navigator.onLine,
                effectiveType: conn ? conn.effectiveType : 'unknown',
            }));

            if (navigator.onLine) {
                measureRealSpeed();
            }
        };

        window.addEventListener('online', updateOnlineState);
        window.addEventListener('offline', updateOnlineState);

        updateOnlineState();

        // Re-measure regularly so the displayed speed tracks real, current
        // conditions instead of a one-time reading from page load.
        intervalId = setInterval(measureRealSpeed, 10000);

        return () => {
            cancelled = true;
            window.removeEventListener('online', updateOnlineState);
            window.removeEventListener('offline', updateOnlineState);
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, []);

    return status;
}
