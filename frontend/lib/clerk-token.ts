type ClerkTokenGetter = () => Promise<string | null>;

type WindowWithClerk = Window & {
    Clerk?: {
        session?: {
            getToken?: () => Promise<string | null | undefined>;
        };
    };
};

let clerkTokenGetter: ClerkTokenGetter | null = null;

export function registerClerkTokenGetter(getter: ClerkTokenGetter) {
    clerkTokenGetter = getter;
}

export async function getClerkToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
        return null;
    }

    if (clerkTokenGetter) {
        try {
            const token = await clerkTokenGetter();
            if (token) {
                return token;
            }
        } catch {}
    }

    const tryWindowClerk = async (): Promise<string | null> => {
        const clerk = (window as WindowWithClerk).Clerk;
        if (!clerk?.session?.getToken) {
            return null;
        }

        try {
            const token = await clerk.session.getToken();
            return token || null;
        } catch {
            return null;
        }
    };

    const immediateWindowToken = await tryWindowClerk();
    if (immediateWindowToken) {
        return immediateWindowToken;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));

        if (clerkTokenGetter) {
            try {
                const token = await clerkTokenGetter();
                if (token) {
                    return token;
                }
            } catch {}
        }

        const fallbackToken = await tryWindowClerk();
        if (fallbackToken) {
            return fallbackToken;
        }
    }

    return null;
}

export async function withClerkAuthorization(headers: HeadersInit = {}): Promise<HeadersInit> {
    const token = await getClerkToken();
    if (!token) {
        return headers;
    }

    return {
        ...headers,
        Authorization: `Bearer ${token}`,
    };
}
