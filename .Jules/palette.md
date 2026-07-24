## 2024-05-18 - Ensure Dropdowns Share State
**Learning:** Adding ARIA attributes like `aria-haspopup="menu"` and `aria-expanded` greatly improves the screen reader accessibility for custom built dropdown toggles and hamburger menus.
**Action:** Always verify that such custom menus and toggles explicitly set `aria-haspopup` and accurately reflect their open/closed state through a dynamic `aria-expanded` attribute.
