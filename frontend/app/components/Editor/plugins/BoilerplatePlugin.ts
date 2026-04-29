import { Extension } from '@codemirror/state';

/**
 * DEPRECATED: This plugin previously handled boilerplate via CodeMirror widgets.
 * We now use React-based fixed panels in CodeEditor.tsx for better control
 * and to match the user's specific minimalistic layout perfectly.
 */
export const createBoilerplate = (header: string, footer: string): Extension => {
    return []; // Return empty extension to prevent duplicate headers/footers
};

export const boilerplateExtension = (header: string, footer: string): Extension => {
    return []; // Return empty extension
};
