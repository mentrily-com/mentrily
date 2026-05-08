'use client';

import PlaygroundCore from '@/app/components/Playground/PlaygroundCore';
import PublicPlaygroundShell from '@/app/components/Playground/PublicPlaygroundShell';

export default function PlaygroundPage() {
    return (
        <PublicPlaygroundShell embedded showQuestionBuilder>
            <PlaygroundCore initialLangId="javascript" publicSurface />
        </PublicPlaygroundShell>
    );
}
