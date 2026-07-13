## 2024-07-28 - Missing ARIA Labels on Dashboard Icon Buttons
**Learning:** Found a pattern of missing ARIA labels on utility icon buttons (Delete, Edit, Close) specifically in the Teacher Dashboard tabs (`GroupsTab.tsx` and `AnnouncementsTab.tsx`), which are entirely screen-reader unreadable without them.
**Action:** Always verify icon-only interactive elements in dashboard lists and modals to ensure `aria-label` attributes accurately describe their destructive or navigational actions.
