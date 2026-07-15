## 2024-07-23 - Frontend Admin Table Optimization
**Learning:** In highly interactive React apps dealing with large datasets, calculating `.toLowerCase()` inside a frequent render's `.filter()` on every keystroke causes perceptible input lag.
**Action:** Always debounce search inputs and lift invariant transformations like `.toLowerCase()` outside the loop (or filter iteration) to reduce time complexity and avoid continuous re-evaluations during active typing.
