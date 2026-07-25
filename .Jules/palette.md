## 2024-05-18 - Missing ARIA attributes on dropdown and menu toggles
**Learning:** Found a recurring accessibility issue where custom dropdown toggles and mobile hamburger menus lack `aria-haspopup="menu"` and dynamic `aria-expanded` attributes, making them difficult for screen reader users to interact with and understand their state.
**Action:** Always add `aria-haspopup="menu"` and dynamically link `aria-expanded` to the toggle's open/close state for all custom dropdowns and hamburger menus.
