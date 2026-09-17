'use client';

import { useState } from 'react';
import Image from 'next/image';
import ImagePreviewModal, { type PreviewImage } from '@/components/ui/ImagePreviewModal';

const SCREENSHOT: PreviewImage = {
    src: '/images/mentrily-ai-chat.png',
    alt: 'Mentrily AI chat: saved chats in the sidebar, starter prompts for /course, /quiz, /explain and /rubric, and the message composer',
};

/** The real /chat screen, framed like the homepage product shot; click to enlarge. */
export default function AiLandingPreview() {
    const [preview, setPreview] = useState<PreviewImage | null>(null);

    return (
        <>
            <button
                type="button"
                onClick={() => setPreview(SCREENSHOT)}
                aria-label="Enlarge the Mentrily AI screenshot"
                className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left transition-shadow duration-300"
                style={{
                    boxShadow:
                        '0 32px 80px rgba(15,23,42,0.12), 0 12px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset',
                }}
            >
                <div className="relative aspect-[1600/780] bg-white">
                    <Image
                        src={SCREENSHOT.src}
                        alt={SCREENSHOT.alt}
                        fill
                        priority
                        sizes="(min-width: 1024px) 60vw, 100vw"
                        className="object-cover object-left-top"
                    />
                </div>
            </button>
            <ImagePreviewModal image={preview} onClose={() => setPreview(null)} />
        </>
    );
}
