## 2024-08-03 - Hamburger Menu Accessibility
**Learning:** Mobile navigation menus using custom icons (like Lucide) often miss critical ARIA attributes out-of-the-box, resulting in a poor screen reader experience where the menu state (expanded/collapsed) and relationship to the navigation drawer are lost.
**Action:** Always ensure custom dropdown toggles and hamburger menus explicitly link the trigger button to the drawer container via `id` and `aria-controls`, include `aria-haspopup="menu"`, and manage a dynamic `aria-expanded` state tied to their open/close state.
