'use client';

export function generatePreviewBlob(html: string, css: string, js: string): string {
    const source = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
        body { 
            margin: 0; 
            padding: 16px; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        ${css}
    </style>
</head>
<body>
    ${html}
    <script>
        // Intercept logs
        const originalLog = console.log;
        console.log = (...args) => {
            window.parent.postMessage({ type: 'CONSOLE_LOG', data: args.join(' ') }, '*');
            originalLog(...args);
        };
        
        try {
            ${js}
        } catch (err) {
            window.parent.postMessage({ type: 'CONSOLE_ERROR', data: err.message }, '*');
        }
    </script>
</body>
</html>
    `;

    const blob = new Blob([source], { type: 'text/html' });
    return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url: string) {
    if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}
