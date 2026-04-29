'use client';

import { ApolloProvider as BaseApolloProvider } from '@apollo/client/react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { makeApolloClient } from '@/lib/apollo-client';

export default function ApolloProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isDashboardRoute = pathname?.startsWith('/dashboard') ?? false;

    const client = useMemo(() => makeApolloClient({ dashboardMode: isDashboardRoute }), [isDashboardRoute]);

    return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
}
