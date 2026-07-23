## 2024-07-23 - ARIA Attributes for Mobile Menus
**Learning:** Custom dropdown toggles and hamburger menus often miss critical ARIA attributes (`aria-expanded`, `aria-haspopup`, `aria-controls`), making them inaccessible to screen readers as they cannot understand the button's state or purpose.
**Action:** Always verify that interactive custom menus and toggles include `aria-haspopup="menu"`, a dynamic `aria-expanded` state tied to their open/close state, and `aria-controls` linked to the menu's ID for screen reader accessibility.
