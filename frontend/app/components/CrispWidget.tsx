'use client';

import { useEffect } from 'react';
import { Crisp } from 'crisp-sdk-web';
import { usePathname } from 'next/navigation';
import { AuthService } from '@/services/api/AuthService';

interface CrispWidgetProps {
    role: 'ADMIN' | 'TEACHER';
}

// Crisp is a global singleton (window.$crisp) — every API call besides
// configure() throws "websiteId must be set" if configure() hasn't run at
// least once yet. Tracked at module scope (not component state) because
// it needs to survive remounts and be visible to every instance.
let crispConfigured = false;

export default function CrispWidget({ role }: CrispWidgetProps) {
    const pathname = usePathname();

    useEffect(() => {
        const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
        if (!websiteId) return;

        if (pathname?.startsWith('/exam')) {
            // Nothing to hide if it was never configured/shown yet — e.g.
            // an exam link opened as the very first page of the session.
            if (crispConfigured) {
                Crisp.chat.hide();
            }
            return;
        }

        if (!crispConfigured) {
            Crisp.configure(websiteId, {
                autoload: true,
            });
            crispConfigured = true;
        }

        let active = true;

        const configureUser = async () => {
            const session = await AuthService.checkSession();
            if (!active || !session) return;

            if (session.email) {
                Crisp.user.setEmail(session.email);
            }
            if (session.name) {
                Crisp.user.setNickname(session.name);
            }

            Crisp.session.setData({
                role,
                plan: String(session.plan || 'FREE'),
                orgId: String(session.orgId || ''),
            });
        };

        void configureUser();
        Crisp.chat.show();

        return () => {
            active = false;
            Crisp.chat.hide();
        };
    }, [pathname, role]);

    return null;
}
