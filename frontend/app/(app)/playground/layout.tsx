import type { Metadata } from 'next';
import React from 'react';

// The /playground routes duplicate the public SEO pages (/online-*-compiler,
// /online-html-editor, /online-python-notebook), so keep them out of search.
export const metadata: Metadata = {
    robots: {
        index: false,
        follow: true,
    },
};

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
