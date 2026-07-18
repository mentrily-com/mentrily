## 2024-05-18 - Component-Level ARIA Expansion States
**Learning:** For custom dropdown toggles and hamburger menus built without primitive libraries, `aria-expanded` and `aria-haspopup` are frequently missed when a local state boolean (like `mobileOpen` or `profileOpen`) is used.
**Action:** When inspecting or building unstyled UI toggles in this app, ensure `aria-expanded` reflects the exact boolean state and `aria-haspopup="menu"` is set when opening a dropdown.
