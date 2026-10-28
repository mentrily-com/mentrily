import type { HTMLAttributes } from 'react';

// Shared root for loading skeletons: one polite "Loading…" announcement, and no shimmer for reduced-motion users.
export default function SkeletonRoot({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            className={`${className} motion-reduce:animate-none motion-reduce:[&_*]:animate-none`}
            {...rest}
        >
            <span className="sr-only">Loading…</span>
            {children}
        </div>
    );
}
