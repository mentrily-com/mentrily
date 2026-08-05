## 2024-05-19 - ARIA attributes for custom dropdowns
**Learning:** When building custom dropdowns (like profile menus) or hamburger menus without native accessible components, screen readers lack context of the button's relationship to the menu.
**Action:** Always link the trigger button to the menu container using `aria-controls` mapping to the container's `id`. Use `aria-expanded` on the trigger, `aria-haspopup="menu"`, and `role="menu"` on the container.
