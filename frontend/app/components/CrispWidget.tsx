'use client';

import { useEffect } from 'react';
import { Crisp } from 'crisp-sdk-web';
import { usePathname } from 'next/navigation';
import { AuthService } from '@/services/api/AuthService';

interface CrispWidgetProps {
    role: 'ADMIN' | 'TEACHER';
}

export default function CrispWidget({ role }: CrispWidgetProps) {
    const pathname = usePathname();

    useEffect(() => {
        const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
        if (!websiteId) return;

        if (pathname?.startsWith('/exam')) {
            Crisp.chat.hide();
            return;
        }

        Crisp.configure(websiteId, {
            autoload: true,
        });

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
