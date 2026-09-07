'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60_000,
                        gcTime: 5 * 60_000,
                        // Was `true` app-wide: every alt-tab/tab-return
                        // triggered a refetch wave for every mounted query,
                        // including the session check -- on the exam page
                        // in particular, that's the same tab-focus event
                        // proctoring already logs as a violation, so it was
                        // adding avoidable network load right when the
                        // heartbeat/socket system is also reacting to it.
                        // staleTime already covers "data went stale while
                        // the tab was in the background" on next access;
                        // opt back in per-query where a page genuinely wants
                        // live-on-refocus data.
                        refetchOnWindowFocus: false,
                        refetchOnReconnect: true,
                        retry: 1,
                    },
                },
            }),
    );

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
