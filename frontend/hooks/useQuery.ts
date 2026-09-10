import { useState, useEffect, useRef } from 'react';

// Global cache object (simple in-memory cache)
const cache = new Map<string, { data: any; timestamp: number }>();
// In-flight requests deduplication
const inflight = new Map<string, Promise<any>>();

interface QueryOptions {
    revalidateOnFocus?: boolean;
    dedupingInterval?: number; // Time in ms to consider data fresh (default 2000ms)
    ttl?: number; // Time to live in cache (default 5min)
}

/**
 * A lightweight hook mimicking React Query / SWR for caching and deduping.
 * Use this to replace simple useEffect fetching logic.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>, options: QueryOptions = {}) {
    const { dedupingInterval = 2000, ttl = 1000 * 60 * 5 } = options;

    // Attempt to read from cache synchronously for initial state
    const cachedEntry = key ? cache.get(key) : undefined;
    const isStale = cachedEntry ? Date.now() - cachedEntry.timestamp > ttl : true;
    const initialData = cachedEntry ? cachedEntry.data : undefined;

    const [data, setData] = useState<T | undefined>(initialData);
    const [error, setError] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!initialData && !!key);
    const [isValidating, setIsValidating] = useState<boolean>(false);

    const keyRef = useRef(key);

    useEffect(() => {
        keyRef.current = key;
        if (!key) return;

        let isMounted = true;

        const fetchData = async () => {
            // Check cache again in case it updated
            const currentCache = cache.get(key);
            const now = Date.now();

            // If we have fresh data in cache (within deduping interval), use it and don't fetch
            if (currentCache && now - currentCache.timestamp < dedupingInterval) {
                if (isMounted) {
                    setData(currentCache.data);
                    setIsLoading(false);
                    setIsValidating(false);
                }
                return;
            }

            // Set loading state (only if we don't have data)
            if (isMounted && !data) setIsLoading(true);
            if (isMounted) setIsValidating(true);

            try {
                // Deduping: Check if a request is already in flight for this key
                let promise = inflight.get(key);
                if (!promise) {
                    promise = fetcher();
                    inflight.set(key, promise);
                }

                const result = await promise;

                // Update Cache
                if (inflight.get(key) === promise) {
                    inflight.delete(key); // Cleanup
                }
                cache.set(key, { data: result, timestamp: Date.now() });

                if (isMounted) {
                    setData(result);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) setError(err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    setIsValidating(false);
                }
            }
        };

        fetchData();

        // Optional: Window focus revalidation could go here

        return () => {
            isMounted = false;
        };
    }, [key, dedupingInterval]); // Fetcher is excluded to avoid loops if unstable reference

    return { data, error, isLoading, isValidating };
}
