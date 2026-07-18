'use client';
import React from 'react';

interface YouTubeSegmentPlayerProps {
    videoId: string;
    startTimeSeconds?: number;
    endTimeSeconds?: number;
    title?: string;
    className?: string;
}

function formatTimestamp(totalSeconds: number) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Borderless YouTube embed that plays only a segment of a video.
 * Uses the official iframe `start`/`end` params (privacy-enhanced
 * youtube-nocookie host, same allowlist as the content sanitizer),
 * so playback stops automatically at `endTimeSeconds`.
 */
export default function YouTubeSegmentPlayer({
    videoId,
    startTimeSeconds,
    endTimeSeconds,
    title,
    className,
}: YouTubeSegmentPlayerProps) {
    const safeId = String(videoId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return null;

    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    const start = Math.max(0, Math.floor(startTimeSeconds || 0));
    const end = Math.floor(endTimeSeconds || 0);
    if (start > 0 || end > start) params.set('start', String(start));
    if (end > start) params.set('end', String(end));

    const src = `https://www.youtube-nocookie.com/embed/${safeId}?${params.toString()}`;
    const hasSegment = start > 0 || end > start;

    return (
        <div className={className || 'not-prose my-8'}>
            <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-lg" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                    src={src}
                    title={title || 'Lesson video'}
                    className="absolute inset-0 h-full w-full"
                    style={{ border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            </div>
            {hasSegment && (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Lesson segment · {formatTimestamp(start)}
                    {end > start ? ` – ${formatTimestamp(end)}` : ''}
                </p>
            )}
        </div>
    );
}
