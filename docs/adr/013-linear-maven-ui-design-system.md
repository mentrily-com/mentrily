# ADR 013: Linear + Maven Hybrid UI Design System and Skeleton Architecture

## Status
Accepted

## Context
Educational platforms frequently suffer from clunky, low-density, inconsistent UIs with mismatched font scales, arbitrary colors, and jarring layout shifts during data loading. The user demands an industry-leading redesign inspired by the sleek precision of Linear and the pedagogical elegance of Maven.

## Decision
We adopt a unified design system standard across all frontend views:
1. **Design Tokens & Geometry**:
   - Palette: High-contrast neutral slates (`#0f172a` deep midnight, `#1e293b` card surfaces) with refined brand teal/cyan accents (`#008D98`, `#00adb5`).
   - Borders & Shadows: Subtle `1px` crisp borders (`border-slate-800` in dark, `border-slate-200` in light), hairline separators, and soft ambient drop shadows.
   - Typography: Clean Inter / Geist font family with disciplined scale (12px caption, 14px body, 16px subhead, 20px title, 28px page header).
2. **Component Conventions**:
   - High-density data tables with sticky headers, column sorting, pagination, and multi-select batch actions.
   - Bento-grid summary cards displaying real-time metrics with sparklines and delta indicators.
   - Fluid split-panes with persistent drag-width memory in localStorage.
3. **Zero-Layout-Shift Loading Skeletons**:
   - Every page must have a dedicated, pixel-matched `loading.tsx` and skeleton component that mirrors the exact DOM geometry of the loaded page.
   - Eliminates generic full-page spinners and visual jumpiness.
   - Smooth pulse animation with shimmer effects matching theme custom properties.

## Consequences
- **Positive**: Exceptional enterprise-grade visual appeal, immediate perceptual speed, and reduced cognitive load for instructors and learners.
- **Negative**: Requires authoring and maintaining bespoke skeleton components for every route and subview.
