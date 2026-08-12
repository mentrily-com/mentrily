## 2024-05-18 - Mobile Hamburger Menu Accessibility
**Learning:** For screen reader accessibility, mobile drawer toggle buttons must be explicitly linked to their drawer containers via `aria-controls` matching the container`s `id`, along with dynamic `aria-expanded` state.
**Action:** Always ensure custom dropdown toggles and hamburger menus include `id`, `aria-controls`, `aria-haspopup="menu"`, and a dynamic `aria-expanded` tied to the open/close state.
