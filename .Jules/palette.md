
## 2024-05-18 - Essential ARIA Attributes for Custom Dropdowns
**Learning:** For custom dropdowns, drawers, and hamburger menus to be fully accessible and understandable by screen readers, they must link their trigger buttons to the container they control using `id` and `aria-controls`. Furthermore, they must include `aria-haspopup="menu"` to indicate the interaction type, and they must manage a dynamic `aria-expanded` state that ties directly to the open/close state.
**Action:** Always verify that interactive custom toggles (like hamburger menus or profile dropdowns) implement `aria-expanded`, `aria-controls`, and `aria-haspopup`, alongside visible focus states (`focus-visible:ring-2 focus-visible:outline-none`).
