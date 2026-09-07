/**
 * Purpose-built loading placeholder for the dynamically-imported
 * `RichTextEditor` (`app/components/Authoring/RichTextEditor.tsx`), used as
 * the `loading` fallback wherever it's lazy-loaded (ReadingEditor,
 * ExamBuilder, CourseBuilder). Those call sites previously passed the
 * generic `DashboardSkeleton type="form" noNavbar`, which renders a
 * full-viewport `h-screen` page shell with a title bar and a 2-column field
 * grid -- wildly oversized and shaped nothing like the small toolbar-plus-
 * editor box it's actually standing in for. This instead mirrors the real
 * editor's rounded card, wrapping icon-button toolbar, and content area
 * proportions (see the `border rounded-[32px]` wrapper and toolbar row in
 * RichTextEditor.tsx) so the editor fades in without the surrounding form
 * jumping in height.
 */
export default function RichTextEditorSkeleton() {
    return (
        <div className="border border-slate-200 rounded-[32px] overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 p-3 border-b border-slate-200 bg-slate-50">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="flex gap-0.5 rounded-xl bg-white/10 p-0.5">
                        <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-200" />
                        <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="min-h-[400px] p-8 space-y-3 bg-white">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
        </div>
    );
}
