'use client';

export interface WebTest {
    id: string;
    description: string;
    test: string; // JavaScript string to execute inside iframe
}

export function generateTestScript(tests: WebTest[]): string {
    return `
    (function() {
        const results = [];
        const tests = ${JSON.stringify(tests)};
        
        tests.forEach(testObj => {
            try {
                // Execute the test string
                const pass = new Function('document', 'getComputedStyle', 'window', \`return (\${testObj.test})\`)(document, getComputedStyle, window);
                results.push({
                    id: testObj.id,
                    description: testObj.description,
                    passed: !!pass
                });
            } catch (err) {
                results.push({
                    id: testObj.id,
                    description: testObj.description,
                    passed: false,
                    error: err.message
                });
            }
        });
        
        window.parent.postMessage({ type: 'TEST_RESULTS', results }, '*');
    })();
    `;
}
