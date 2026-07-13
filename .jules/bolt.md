## 2024-05-24 - React useMemo Import Safety
**Learning:** Modern Next.js/React applications often use the new JSX transform where `React` is not automatically in scope. Using `React.useMemo` without an explicit `import React from "react"` can cause runtime crashes.
**Action:** Always import hooks directly (`import { useMemo } from "react"`) and use `useMemo()` instead of `React.useMemo()` to guarantee safety.
