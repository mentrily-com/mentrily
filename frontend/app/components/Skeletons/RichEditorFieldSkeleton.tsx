/**
 * Purpose-built skeleton for the lazily-loaded rich-text and web editors
 * inside `components/Authoring/QuestionBuilder/QuestionBuilder.tsx`. Both
 * `RichTextEditor` and `WebEditor` are loaded via `next/dynamic` and
 * previously fell back to the generic `DashboardSkeleton type="form"
 * noNavbar`, which renders a page title plus a two-column field grid --
 * completely wrong here, since these editors only ever fill the single
 * rounded content box they're mounted inside (the "Problem Statement"
 * card, or the editor-module card). Mirrors a compact toolbar-plus-editing-
 * area shape sized to sit inside that existing card, rather than a full
 * page layout or exact pixel content.
 */
export default function RichEditorFieldSkeleton() {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 w-6 animate-pulse rounded-md bg-slate-100" />
                ))}
            </div>
            <div className="p-4 space-y-2.5">
                <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
        </div>
    );
}
