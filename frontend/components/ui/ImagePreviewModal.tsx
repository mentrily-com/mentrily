'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export type PreviewImage = {
    src: string;
    alt: string;
};

export default function ImagePreviewModal({ image, onClose }: { image: PreviewImage | null; onClose: () => void }) {
    useEffect(() => {
        if (!image) return;

        const timeout = window.setTimeout(onClose, 3000);
        return () => window.clearTimeout(timeout);
    }, [image, onClose]);

    if (!image) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 px-3 py-6 backdrop-blur-sm sm:px-6"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close image preview"
            >
                <X size={20} />
            </button>
            <div className="relative h-full max-h-[88vh] w-full max-w-7xl" onClick={(event) => event.stopPropagation()}>
                <Image src={image.src} alt={image.alt} fill sizes="100vw" className="object-contain" priority />
            </div>
        </div>
    );
}
