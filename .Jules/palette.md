## 2024-10-24 - Dropdown/Drawer Accessibility Connection
**Learning:** Custom dropdown toggles (like profile menus) and mobile hamburger drawers require explicit DOM connections via `id` and `aria-controls`, along with dynamic `aria-expanded` attributes, to ensure screen reader visibility of their state.
**Action:** Always verify that interactive overlay triggers are explicitly connected to their respective containers using `aria-controls`, specify `aria-haspopup`, and accurately reflect open/close state using `aria-expanded`.
