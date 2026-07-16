## 2024-05-14 - DOM-based XSS in HTML parsing
**Vulnerability:** Cross-Site Scripting (XSS) vulnerability found in `frontend/app/components/Playground/PlaygroundCore.tsx` where `element.innerHTML` was used to parse HTML text and strip tags.
**Learning:** Using `innerHTML` on unattached DOM elements is still dangerous as browsers may attempt to fetch resources or execute inline event handlers (like `<img src=x onerror=alert(1)>`).
**Prevention:** Always use `new DOMParser().parseFromString(html, 'text/html')` to safely parse HTML into a DOM tree when extracting text, instead of assigning directly to `innerHTML`.
